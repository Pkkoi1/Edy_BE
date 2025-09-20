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

const approveRequest = async (requestId, reviewerId) => {
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) throw new Error("Người duyệt không tồn tại");

    const approvalRequest = await ApprovalRequest.findById(requestId);
    if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");

    approvalRequest.reviewed_by = reviewer._id;
    approvalRequest.reviewed_at = new Date();
    approvalRequest.status = "Approved";
    await approvalRequest.save();

    //gửi thông báo cho người đăng (để sau)

    return approvalRequest;
};

const rejectDocument = async (requestId, reviewerId, reason) => {
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) throw new Error("Người duyệt không tồn tại");

    const approvalRequest = await ApprovalRequest.findById(requestId);
    if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");

    approvalRequest.reviewed_by = reviewer._id;
    approvalRequest.reviewed_at = new Date();
    approvalRequest.status = "Rejected";
    approvalRequest.reason = reason;
    await approvalRequest.save();

    //gửi thông báo cho người đăng (để sau)

    return approvalRequest;
};

module.exports = {
    createApprovalRequest,
    approveRequest,
};
