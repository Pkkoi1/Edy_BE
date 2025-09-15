const ApprovalRequest = require("../models/approval_request.model");

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
};

const approveRequest = async (requestId, approverId) => {
    const approver = await User.findById(approverId);
    if (!approver) throw new Error("Người duyệt không tồn tại");

    const approvalRequest = await ApprovalRequest.findById(requestId);
    if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");

    approvalRequest.approved_by = approver._id;
    approvalRequest.approved_at = new Date();
    approvalRequest.status = "Approved";
    await approvalRequest.save();
    return approvalRequest;
};

module.exports = {
    createApprovalRequest,
    approveRequest,
};
