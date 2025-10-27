const ApprovalRequest = require("../models/approval_request.model");
const User = require("../models/user.model");
const Document = require("../models/document.model");
const Organization = require("../models/organization.model");
const {
  createPointTransaction,
  earnPoints,
} = require("./point_transaction.service");
const { indexDocument } = require("./elasticsearch.service");

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

    Document.findByIdAndUpdate(
      document._id,
      { summary_status: "PENDING" },
      { new: true }
    );
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

  let documentChanged = false;

  // Kiểm tra loại request
  if (approvalRequest.is_summary) {
    // Approve summary request
    document.summary_status = "APPROVED";
    documentChanged = true;
  } else {
    // Approve document request
    document.status = "APPROVED";
    document.last_approved_at = current;
    documentChanged = true;

    // Tăng doc_count cho user chỉ khi approve document
    const user = await User.findById(approvalRequest.requester);
    if (user) {
      user.doc_count = (user.doc_count || 0) + 1;
      await user.save();
    }

    //Them vao subjects va content_categories cua org
    if (organization) {
      if (document.subject) {
        const existingSubject = organization.subjects.find(
          (s) => s.subject.toString() === document.subject.toString()
        );

        if (existingSubject) {
          // Tăng count cho subject đã tồn tại
          existingSubject.count = (existingSubject.count || 0) + 1;
        } else {
          // Thêm subject mới
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
  }

  if (isIntensive && !approvalRequest.is_summary) {
    // Chỉ set intensive khi approve document request
    document.intensive = true;
    documentChanged = true;
  }

  if (documentChanged) await document.save();

  // Cập nhật Elasticsearch
  if (documentChanged) {
    try {
      await indexDocument(document);
    } catch (error) {
      console.error(
        `Lỗi cập nhật tài liệu ${document._id} trong Elasticsearch: ${error.message}`
      );
    }
  }

  //tính điểm lần đăng này
  if (!approvalRequest.is_summary) {
    const isFirstApproval =
      (await ApprovalRequest.countDocuments({
        requester: approvalRequest.requester,
        status: "APPROVED",
        doc: { $ne: approvalRequest.doc },
      })) === 0;
    const base = isFirstApproval ? 20 : 15;
    const total = isIntensive ? base + 5 : base;
    await earnPoints(user._id, total, `Đăng tài liệu ${document.title}`);
  }

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

  let documentChanged = false;

  if (approvalRequest.is_summary) {
    // Reject summary request
    document.summary_status = "REJECTED";
    documentChanged = true;
  } else {
    // Reject document request
    document.status = "REJECTED";
    document.is_deleted = true;
    document.expiredAt = current + 7 * 24 * 60 * 60 * 1000;

    documentChanged = true;
  }

  if (documentChanged) await document.save();

  //gửi thông báo cho người đăng (để sau)

  return approvalRequest;
};

module.exports = {
  createApprovalRequest,
  getPendingRequestsByDocument,
  approveRequest,
  rejectRequest,
};
