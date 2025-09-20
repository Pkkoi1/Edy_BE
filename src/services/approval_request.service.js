const ApprovalRequest = require("../models/approval_request.model");
const User = require("../models/user.model");
const Document = require("../models/document.model");

const createApprovalRequest = async (documentId, requesterId) => {
    const requester = await User.findById(requesterId);
    if (!requester) throw new Error("Người yêu cầu không tồn tại");

    const document = await Document.findById(documentId);
    if (!document) throw new Error("Tài liệu không tồn tại");

    const approvalRequests = [];

    // Tạo request cho tài liệu 
    const approvalRequest = new ApprovalRequest({
        doc: document._id,
        requester: requester._id,
    });
    approvalRequests.push(approvalRequest);

    // Nếu có nếu có omts tắt thì tọa thêm nữa
    if (document.description && document.description.summary_by_user) {
        const summaryApprovalRequest = new ApprovalRequest({
            doc: document._id,
            requester: requester._id,
            is_summary: true,
        });
        approvalRequests.push(summaryApprovalRequest);
    }

    // Lưu tất cả các request
    for (const req of approvalRequests) {
        await req.save();
    }

    // Kiểm duyệt mềm bằng AI
    // checkDocumentWithAI(approvalRequests); ý tưởng ban đầu: đưa vào mảng request, is_summary false thì chỉ đưa context là tài liệu, true thì đưa context là summary_by_user cùng với tài liệu để check

    //kiểm duyệt mềm nếu auto_approve thì tạo summary bằng ai (có thể để hàm check phía trên trả kết quả rồi dùng if để gọi hàm gen hoặc đưa hàm gen vào bên trong hàm check luôn)
    // generateSummaryByAI(document._id, file_type, url);
};

const getPendingRequestsByDocument = async (documentId) => {
    return ApprovalRequest.find({ doc: documentId, status: "PENDING" })
};

const approveRequest = async (requestId, reviewerId) => {
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) throw new Error("Người duyệt không tồn tại");

    const approvalRequest = await ApprovalRequest.findById(requestId);
    if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");

    approvalRequest.reviewed_by = reviewer._id;
    approvalRequest.reviewed_at = new Date();
    approvalRequest.status = "APPROVED";
    await approvalRequest.save();

    const pendingRequests = await getPendingRequestsByDocument(approvalRequest.doc);
    const document = await Document.findById(approvalRequest.doc);
    
    if (!document) throw new Error("Tài liệu không tồn tại");

    if (pendingRequests.length === 0) {
        // Không còn request pending nào -> APPROVED hoàn toàn
        document.status = "APPROVED";
        await document.save();
        
        // Tăng doc_count cho user
        const user = await User.findById(approvalRequest.requester);
        if (user) {
            user.doc_count = (user.doc_count || 0) + 1;
            await user.save();
        }
    } else {
        // Còn request pending -> kiểm tra loại
        const hasSummaryPending = pendingRequests.some(req => req.is_summary === true);
        const hasDocumentPending = pendingRequests.some(req => req.is_summary === false);
        
        if (hasSummaryPending && !hasDocumentPending) {
            // Chỉ còn summary pending -> chuyển sang PENDING_SUMMARY
            document.status = "PENDING_SUMMARY";
            await document.save();
        }
        // Nếu còn document pending thì giữ nguyên status PENDING
    }

    //gửi thông báo cho người đăng (để sau)

    return approvalRequest;
};

const rejectRequest = async (requestId, reviewerId, message) => {
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) throw new Error("Người duyệt không tồn tại");

    const approvalRequest = await ApprovalRequest.findById(requestId);
    if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");

    approvalRequest.reviewed_by = reviewer._id;
    approvalRequest.reviewed_at = new Date();
    approvalRequest.status = "REJECTED";
    approvalRequest.message = reason;
    await approvalRequest.save();

    const document = await Document.findById(approvalRequest.doc);
    if (!document) throw new Error("Tài liệu không tồn tại");

    // Kiểm tra nếu đang reject summary request
    if (approvalRequest.is_summary) {
        // Tìm document request gần nhất (không phải summary)
        const latestDocumentRequest = await ApprovalRequest.findOne({
            doc: approvalRequest.doc,
            is_summary: false
        }).sort({ createdAt: -1 });

        // Kiểm tra xem có pending request nào khác không (trừ summary request vừa reject)
        const hasPendingRequests = await ApprovalRequest.exists({
            doc: approvalRequest.doc,
            _id: { $ne: requestId },
            status: "PENDING"
        });

        // Nếu document request gần nhất đã approve và không còn pending request nào khác
        if (latestDocumentRequest && latestDocumentRequest.status === "APPROVED" && !hasPendingRequests) {
            document.status = "APPROVED";
            await document.save();

            const user = await User.findById(approvalRequest.requester);
            if (user) {
                // Kiểm tra xem đã tăng doc_count chưa dựa vào thời gian approve document request
                if (latestDocumentRequest.reviewed_at && latestDocumentRequest.reviewed_at < approvalRequest.reviewed_at) {
                    // Document đã được approve trước đó, không cần tăng doc_count nữa
                } else {
                    user.doc_count = (user.doc_count || 0) + 1;
                    await user.save();
                }
            }
        }
    } else {
        // Nếu reject document request, tìm document request gần nhất khác
        const latestApprovedDocumentRequest = await ApprovalRequest.findOne({
            doc: approvalRequest.doc,
            is_summary: false,
            status: "APPROVED",
            _id: { $ne: requestId }
        }).sort({ createdAt: -1 });

        // Chỉ chuyển về REJECTED nếu không có document request nào khác được approve
        if (!latestApprovedDocumentRequest) {
            document.status = "REJECTED";
            await document.save();
        }
    }

    //gửi thông báo cho người đăng (để sau)

    return approvalRequest;
};

module.exports = {
    createApprovalRequest,
    getPendingRequestsByDocument,
    approveRequest,
    rejectRequest
};
