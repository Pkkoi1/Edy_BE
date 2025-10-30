const ApprovalRequest = require("../models/approval_request.model");
const User = require("../models/user.model");
const Document = require("../models/document.model");
const Organization = require("../models/organization.model");
const Subject = require("../models/subject.model");
const { indexDocument, updateDocument: updateESDocument, deleteDocument: deleteESDocument } = require('./elasticsearch.service');
const { processDocumentWithGeminiAI } = require("../utils/tranformers");
const {
    createPointTransaction,
    earnPoints,
} = require("./point_transaction.service");

const createApprovalRequest = async (documentId, requesterId) => {
    const requester = await User.findById(requesterId);
    if (!requester) throw new Error("Người yêu cầu không tồn tại");

    const document = await Document.findById(documentId);
    if (!document) throw new Error("Tài liệu không tồn tại");

    const approvalRequest = new ApprovalRequest({
        doc: document._id,
        requester: requester._id,
    });

    await approvalRequest.save();

    // đưa thêm tên của subject
    const subject = await Subject.findById(document.subject);
    // Xử lý thông qua AI bao gồm tóm tắt và kiểm duyệt mềm (chạy async không block)
    processDocumentWithAI(approvalRequest._id, document, subject.name).catch(error => {
        console.error(`Lỗi khi xử lý AI cho document ${document._id}:`, error);
        // Không throw error để không ảnh hưởng đến việc tạo approval request
    });

    return approvalRequest;
};

/**
 * Xử lý tài liệu với AI để tóm tắt và kiểm duyệt
 * @param {string} approvalRequestId - ID của approval request
 * @param {Object} document - Document object
 */
const processDocumentWithAI = async (approvalRequestId, document, subjectName) => {
    try {
        // Chỉ xử lý PDF và WORD
        if (!['PDF', 'WORD'].includes(document.file_type)) {
            console.log(`Bỏ qua AI check cho file type: ${document.file_type}`);
            return;
        }

        console.log(`Bắt đầu xử lý AI cho document ${document._id}...`);

        const documentMetadata = {
            title: document.title,
            summary_by_user: document.description?.summary_by_user || '',
            author: document.author,
            publisher: document.publisher,
            published_year: document.published_year,
            keyword: document.keyword,
            subject_name: subjectName || ''
        };

        // Gọi Gemini AI - pass metadata để kiểm tra
        const result = await processDocumentWithGeminiAI(
            document.url, 
            document.file_type,
            documentMetadata
        );

        // Cập nhật approval request với kết quả AI check
        const approvalRequest = await ApprovalRequest.findById(approvalRequestId);
        if (!approvalRequest) {
            console.error('Không tìm thấy approval request');
            return;
        }

        approvalRequest.ai_checked = true;
        approvalRequest.ai_violation_level = result.aiCheck.violation_level;
        approvalRequest.ai_action_suggest = result.aiCheck.action_suggest;
        
        // Bổ sung thông tin metadata validation vào reason
        let reason = result.aiCheck.reason;
        if (!result.metadata_valid) {
            reason = `[Metadata không hợp lệ] ${reason}`;
        }
        if (result.is_intensive) {
            reason = `[Tài liệu chuyên sâu] ${reason}`;
        }
        approvalRequest.ai_reason = reason;

        if (result.aiCheck.action_suggest === 'AUTO_APPROVE') {
            console.log(`AI suggest AUTO_APPROVE - tự động duyệt document ${document._id}`);
            
            // Tự động approve
            await autoApproveByAI(approvalRequest, document, result);
        } else {
            // nếu ko chắc thì đưa admin và lưu tóm tắt vào doc
            const doc = await Document.findById(document._id);
            if (doc) {
                if (!doc.description) {
                    doc.description = {};
                }
                doc.description.summary_by_ai = result.summary;
                await doc.save();
            }

            await approvalRequest.save();
            console.log(`AI suggest ${result.aiCheck.action_suggest} - chờ admin review`);
        }

        console.log(`Hoàn thành xử lý AI cho document ${document._id}`);
    } catch (error) {
        console.error(`Lỗi trong processDocumentWithAI:`, error);
        // Fallback logic
        try {
            const approvalRequest = await ApprovalRequest.findById(approvalRequestId);
            if (approvalRequest) {
                approvalRequest.ai_checked = true;
                approvalRequest.ai_violation_level = 'MEDIUM';
                approvalRequest.ai_action_suggest = 'MANUAL_REVIEW';
                approvalRequest.ai_reason = `Lỗi khi xử lý AI: ${error.message}`;
                await approvalRequest.save();
            }
        } catch (updateError) {
            console.error('Lỗi khi cập nhật approval request:', updateError);
        }
    }
};

const autoApproveByAI = async (approvalRequest, document, aiResult) => {
    try {
        const user = await User.findById(approvalRequest.requester);
        if (!user) throw new Error("Người yêu cầu không tồn tại");
        
        const current = new Date();

        approvalRequest.reviewed_by = null;
        approvalRequest.reviewed_at = current;
        approvalRequest.status = "APPROVED";
        await approvalRequest.save();

        document.status = "APPROVED";
        document.last_approved_at = current;
        
        if (!document.description) {
            document.description = {};
        }
        document.description.summary_by_ai = aiResult.summary;
        
        if (aiResult.is_intensive) {
            document.intensive = true;
        }

        await document.save();

        // Tăng doc_count cho user
        user.doc_count = (user.doc_count || 0) + 1;
        await user.save();

        // Cập nhật organization statistics
        const organization = await Organization.findById(document.organization);
        if (organization) {
            if (document.subject) {
                const existingSubject = organization.subjects.find(s =>
                    s.subject.toString() === document.subject.toString()
                );

                if (existingSubject) {
                    existingSubject.count = (existingSubject.count || 0) + 1;
                } else {
                    organization.subjects.push({
                        subject: document.subject,
                        count: 1
                    });
                }
            }

            if (document.doc_type) {
                const existingCategory = organization.content_categories.find(
                    (c) => c.doc_type === document.doc_type
                );

                if (existingCategory) {
                    existingCategory.document_count = (existingCategory.document_count || 0) + 1;
                } else {
                    organization.content_categories.push({
                        doc_type: document.doc_type,
                        document_count: 1,
                    });
                }
            }
            await organization.save();
        }

        // Index vào Elasticsearch
        try {
            await updateESDocument(document._id.toString(), {
                status: 'APPROVED',
                last_approved_at: current
            });
        } catch (error) {
            console.error(`Lỗi cập nhật tài liệu ${document._id} trong Elasticsearch: ${error.message}`);
        }

        // Tính điểm cho user
        const isFirstApproval = (await ApprovalRequest.countDocuments({
            requester: approvalRequest.requester,
            status: "APPROVED",
            doc: { $ne: approvalRequest.doc },
        })) === 0;
        
        const base = isFirstApproval ? 20 : 15;
        const total = aiResult.is_intensive ? base + 5 : base;
        await earnPoints(user._id, total, `Đăng tài liệu ${document.title} (Tự động duyệt bởi AI)`);

        console.log(`Tự động duyệt thành công document ${document._id} bởi AI`);
    } catch (error) {
        console.error(`Lỗi khi tự động duyệt document ${document._id}:`, error);
        throw error;
    }
};

const getPendingRequestsByDocument = async (documentId) => {
    return ApprovalRequest.find({ doc: documentId, status: "PENDING" });
};

const approveRequest = async (requestId, reviewerId, isIntensive) => {
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) throw new Error("Người duyệt không tồn tại");

    const approvalRequest = await ApprovalRequest.findById(requestId);
    if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");

    const user = await User.findById(approvalRequest.requester);
    if (!user) throw new Error("Người yêu cầu không tồn tại");
    const current = new Date();

    approvalRequest.reviewed_by = reviewer._id;
    approvalRequest.reviewed_at = current;
    approvalRequest.status = "APPROVED";
    await approvalRequest.save();

    const document = await Document.findById(approvalRequest.doc);
    if (!document) throw new Error("Tài liệu không tồn tại");
    const organization = await Organization.findById(document.organization);

    // Cập nhật document status
    document.status = "APPROVED";
    document.last_approved_at = current;

    // Tăng doc_count cho user
    user.doc_count = (user.doc_count || 0) + 1;
    await user.save();

    // Thêm vào subjects và content_categories của org
    if (organization) {
        if (document.subject) {
            const existingSubject = organization.subjects.find(s =>
                s.subject.toString() === document.subject.toString()
            );

            if (existingSubject) {
                existingSubject.count = (existingSubject.count || 0) + 1;
            } else {
                organization.subjects.push({
                    subject: document.subject,
                    count: 1
                });
            }
        }

        if (document.doc_type) {
            const existingCategory = organization.content_categories.find(
                (c) => c.doc_type === document.doc_type
            );

            if (existingCategory) {
                // Tăng document_count cho category đã tồn tại
                existingCategory.document_count =
                    (existingCategory.document_count || 0) + 1;
            } else {
                // Thêm category mới
                organization.content_categories.push({
                    doc_type: document.doc_type,
                    document_count: 1,
                });
            }
        }
        await organization.save();
    }


    if (isIntensive) {
        document.intensive = true;
    }

    await document.save();

    // Cập nhật Elasticsearch
    try {
        await updateESDocument(document._id.toString(), {
            status: 'APPROVED',
            last_approved_at: current
        });
    } catch (error) {
        console.error(`Lỗi cập nhật tài liệu ${document._id} trong Elasticsearch: ${error.message}`);
    }

    //tính điểm lần đăng này

    const isFirstApproval =
        (await ApprovalRequest.countDocuments({
            requester: approvalRequest.requester,
            status: "APPROVED",
            doc: { $ne: approvalRequest.doc },
        })) === 0;
    const base = isFirstApproval ? 20 : 15;
    const total = isIntensive ? base + 5 : base;
    await earnPoints(user._id, total, `Đăng tài liệu ${document.title}`);

    //gửi thông báo cho người đăng (để sau)

    return approvalRequest;
}

const rejectRequest = async (requestId, reviewerId, message) => {
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) throw new Error("Người duyệt không tồn tại");

    const approvalRequest = await ApprovalRequest.findById(requestId);
    if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");

    const current = new Date();
    approvalRequest.reviewed_by = reviewer._id;
    approvalRequest.reviewed_at = current;
    approvalRequest.status = "REJECTED";
    approvalRequest.message = message;
    approvalRequest.expiredAt = current + 7 * 24 * 60 * 60 * 1000;
    await approvalRequest.save();

    const document = await Document.findById(approvalRequest.doc);
    if (!document) throw new Error("Tài liệu không tồn tại");

    // Reject document
    document.status = "REJECTED";
    document.is_deleted = true;
    document.expiredAt = current + 7 * 24 * 60 * 60 * 1000;
    await document.save();

    try {
        await deleteESDocument(document._id.toString());
    } catch (error) {
        console.error(`Lỗi xóa tài liệu ${document._id} trong Elasticsearch: ${error.message}`);
    }

    //gửi thông báo cho người đăng (để sau)

    return approvalRequest;
};

module.exports = {
    createApprovalRequest,
    getPendingRequestsByDocument,
    approveRequest,
    rejectRequest,
    processDocumentWithAI
};
