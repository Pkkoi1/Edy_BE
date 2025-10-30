const ApprovalRequest = require("../models/approval_request.model");
const User = require("../models/user.model");
const Document = require("../models/document.model");
const Organization = require("../models/organization.model");
const { indexDocument } = require("./elasticsearch.service");
const { processDocumentWithGeminiAI } = require("../utils/tranformers");
const {
  createPointTransaction,
  earnPoints,
} = require("./point_transaction.service");
const { updateDocumentTypeCount } = require("./user_statistics.service");

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

  // Xử lý thông qua AI bao gồm tóm tắt và kiểm duyệt mềm (chạy async không block)
  processDocumentWithAI(approvalRequest._id, document).catch((error) => {
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
const processDocumentWithAI = async (approvalRequestId, document) => {
  try {
    // Chỉ xử lý PDF và WORD
    if (!["PDF", "WORD"].includes(document.file_type)) {
      console.log(`Bỏ qua AI check cho file type: ${document.file_type}`);
      return;
    }

    console.log(`Bắt đầu xử lý AI cho document ${document._id}...`);

    // Gọi Gemini AI để lấy cả summary và violation check
    const result = await processDocumentWithGeminiAI(
      document.url,
      document.file_type
    );

    // Cập nhật approval request với kết quả AI check
    const approvalRequest = await ApprovalRequest.findById(approvalRequestId);
    if (approvalRequest) {
      approvalRequest.ai_checked = true;
      approvalRequest.ai_violation_level = result.aiCheck.violation_level;
      approvalRequest.ai_action_suggest = result.aiCheck.action_suggest;
      approvalRequest.ai_reason = result.aiCheck.reason;
      await approvalRequest.save();
    }

    // Cập nhật document với summary từ AI
    const doc = await Document.findById(document._id);
    if (doc) {
      if (!doc.description) {
        doc.description = {};
      }
      doc.description.summary_by_ai = result.summary;
      await doc.save();
    }

    console.log(`Hoàn thành xử lý AI cho document ${document._id}`);
  } catch (error) {
    console.error(`Lỗi trong processDocumentWithAI:`, error);
    // Cập nhật approval request với lỗi (nếu cần)
    try {
      const approvalRequest = await ApprovalRequest.findById(approvalRequestId);
      if (approvalRequest) {
        approvalRequest.ai_checked = true;
        approvalRequest.ai_violation_level = "MEDIUM";
        approvalRequest.ai_action_suggest = "MANUAL_REVIEW";
        approvalRequest.ai_reason = `Lỗi khi xử lý AI: ${error.message}`;
        await approvalRequest.save();
      }
    } catch (updateError) {
      console.error("Lỗi khi cập nhật approval request:", updateError);
    }
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
      const existingSubject = organization.subjects.find(
        (s) => s.subject.toString() === document.subject.toString()
      );

      if (existingSubject) {
        existingSubject.count = (existingSubject.count || 0) + 1;
      } else {
        organization.subjects.push({
          subject: document.subject,
          count: 1,
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

  // Cập nhật thống kê loại tài liệu
  try {
    await updateDocumentTypeCount(user._id, document.doc_type);
  } catch (statsError) {
    console.error("Lỗi cập nhật thống kê loại tài liệu:", statsError);
  }

  // Cập nhật Elasticsearch
  try {
    await indexDocument(document);
  } catch (error) {
    console.error(
      `Lỗi cập nhật tài liệu ${document._id} trong Elasticsearch: ${error.message}`
    );
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
};

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

  //gửi thông báo cho người đăng (để sau)

  return approvalRequest;
};

module.exports = {
  createApprovalRequest,
  getPendingRequestsByDocument,
  approveRequest,
  rejectRequest,
  processDocumentWithAI,
};
