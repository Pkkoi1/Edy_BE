const mongoose = require("mongoose");
const ApprovalRequest = require("../models/approval_request.model");
const User = require("../models/user.model");
const Document = require("../models/document.model");
const Organization = require("../models/organization.model");
const Subject = require("../models/subject.model");
const Assignment = require("../models/assignment.model");
const Account = require("../models/account.model");
const Role = require("../models/role.model");
const {
  indexDocument,
  updateDocument: updateESDocument,
  deleteDocument: deleteESDocument,
  findSimilarDocumentsForAdmin,
} = require("./elasticsearch.service");
const { processDocumentWithGeminiAI } = require("../utils/tranformers");
const {
  createPointTransaction,
  earnPoints,
} = require("./point_transaction.service");
const { updateDocumentTypeCount } = require("./user_statistics.service");
const { updateDocumentApproved } = require("./document_statistics.service");
const {
  canCreateEmbedding,
  embeddinngDocument,
} = require("./document.service");
const { logActivity } = require("./activity_log.service");
const { notifyPointsEarned } = require("./notification.service");

const createApprovalRequest = async (documentId, requesterId) => {
  try {
    const requester = await User.findById(requesterId);
    if (!requester) throw new Error("Người yêu cầu không tồn tại");

    const document = await Document.findById(documentId);
    if (!document) throw new Error("Tài liệu không tồn tại");

    const approvalRequest = new ApprovalRequest({
      doc: document._id,
      requester: requester._id,
    });

    await approvalRequest.save();

    // Log activity
    await logActivity({
      userId: requesterId,
      action: "APPROVAL_REQUEST_CREATED",
      targetType: "ApprovalRequest",
      targetId: approvalRequest._id,
      targetTitle: document.title,
      description: `Tạo yêu cầu duyệt tài liệu "${document.title}"`,
      metadata: {
        documentId: document._id,
        documentTitle: document.title,
      },
    });

    combineChecking(documentId, approvalRequest._id).catch((error) => {
      console.error(`Lỗi khi combineChecking chạy nền: ${error.message}`);
    });

    return approvalRequest;
  } catch (error) {
    console.error(`Lỗi trong khi tạo approval request: ${error.message}`);
    throw new Error(`Lỗi trong khi tạo approval request: ${error.message}`);
  }
};

const combineChecking = async (documentId, approvalRequestId) => {
  try {
    const document = await Document.findById(documentId);
    const approvalRequest = await ApprovalRequest.findById(approvalRequestId);

    if (canCreateEmbedding(document.file_type, document.url)) {
      await embeddinngDocument(document);
      console.log("Tạo embedding thành công");
      await checkSimilarity(documentId, approvalRequestId);
      console.log("Kiểm tra tương đồng thành công");
    } else {
      // await assignApprovalRequest(
      //   approvalRequestId,
      //   document.organization || null
      // );
      return approvalRequest;
    }
  } catch (error) {
    console.error(`Lỗi trong combineChecking: ${error.message}`);
    const document = await Document.findById(documentId);
    // await assignApprovalRequest(
    //   approvalRequestId,
    //   document.organization || null
    // );
    return;
  }
};
const checkSimilarity = async (documentId, approvalRequestId) => {
  const document = await Document.findById(documentId);
  const approvalRequest = await ApprovalRequest.findById(approvalRequestId);
  //Xử lý trước nếu tương đồng cao thì đánh dấu rồi return luôn chứ ko thông qua AI
  try {
    if (!["PDF", "WORD"].includes(document.file_type)) {
      // await assignApprovalRequest(
      //   approvalRequestId,
      //   document.organization || null
      // );
      return approvalRequest;
    }

    const { documentIds, scores } = await findSimilarDocumentsForAdmin(
      document._id,
      1
    );
    const hasHighSimilarity = documentIds.length > 0;
    if (hasHighSimilarity) {
      approvalRequest.ai_checked = true;
      approvalRequest.ai_violation_level = "MEDIUM";
      approvalRequest.ai_action_suggest = "MANUAL_REVIEW";
      approvalRequest.ai_reason = "Tài liệu tương đồng cao";
      await approvalRequest.save();

      document.description.summary_by_ai = "Tài liệu tương đồng cao";
      await document.save();

      // // Tự động gán approval request cho admin có ít pending request nhất
      // await assignApprovalRequest(
      //   approvalRequest._id,
      //   document.organization || null
      // );
      return approvalRequest;
    }
    // nếu ko có thì đưa thêm tên của subject rồi xử lý AI
    const subject = await Subject.findById(document.subject);
    await processDocumentWithAI(
      approvalRequest._id,
      document,
      subject.name || ""
    );
  } catch (error) {
    console.error(
      `Lỗi khi xử lý tương đồng cao cho document ${document._id}:`,
      error
    );
    // await assignApprovalRequest(
    //   approvalRequest._id,
    //   document.organization || null
    // );
    return approvalRequest;
  }
};

const processDocumentWithAI = async (
  approvalRequestId,
  document,
  subjectName
) => {
  try {
    // Chỉ xử lý PDF và WORD
    if (!["PDF", "WORD"].includes(document.file_type)) {
      console.log(`Bỏ qua AI check cho file type: ${document.file_type}`);
      // ko cần gán vì ở similarity gán sẵn r
      return;
    }

    const documentMetadata = {
      title: document.title,
      summary_by_user: document.description?.summary_by_user || "",
      author: document.author,
      publisher: document.publisher,
      published_year: document.published_year,
      keyword: document.keyword,
      subject_name: subjectName || "",
    };

    const result = await processDocumentWithGeminiAI(
      document.url,
      document.file_type,
      documentMetadata
    );

    // Cập nhật approval request với kết quả AI check
    const approvalRequest = await ApprovalRequest.findById(approvalRequestId);
    if (!approvalRequest) {
      console.error("Không tìm thấy approval request");
      return;
    }

    approvalRequest.ai_checked = true;
    approvalRequest.ai_violation_level = result.aiCheck.violation_level;
    approvalRequest.ai_action_suggest = result.aiCheck.action_suggest;

    // Bổ sung thông tin metadata validation vào reason
    let reason = result.aiCheck.reason;
    if (result.metadata_valid !== undefined && !result.metadata_valid) {
      reason = `[Metadata không hợp lệ] ${reason}`;
    }
    if (result.is_intensive) {
      reason = `[Tài liệu chuyên sâu] ${reason}`;
    }
    approvalRequest.ai_reason = reason;

    if (result.aiCheck.action_suggest === "AUTO_APPROVE") {
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

      // // Gán approval request cho admin có ít pending request nhất
      // await assignApprovalRequest(
      //   approvalRequest._id,
      //   document.organization || null
      // );

      await approvalRequest.save();
    }
  } catch (error) {
    console.error(`Lỗi trong processDocumentWithAI:`, error);
    // Fallback logic
    try {
      const approvalRequest = await ApprovalRequest.findById(approvalRequestId);
      if (approvalRequest) {
        approvalRequest.ai_checked = true;
        approvalRequest.ai_violation_level = "NONE";
        approvalRequest.ai_action_suggest = "MANUAL_REVIEW";
        approvalRequest.ai_reason = `Lỗi khi xử lý AI: ${error.message}`;
        await approvalRequest.save();

        // await assignApprovalRequest(
        //   approvalRequest._id,
        //   document.organization || null
        // );
      }
    } catch (updateError) {
      console.error("Lỗi khi cập nhật approval request:", updateError);
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
    document.approved_by_ai = true;
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
          existingCategory.document_count =
            (existingCategory.document_count || 0) + 1;
        } else {
          organization.content_categories.push({
            doc_type: document.doc_type,
            document_count: 1,
          });
        }
      }
      await organization.save();
    }

    try {
      await updateDocumentTypeCount(user._id, document.doc_type);
    } catch (statsError) {
      console.error("Lỗi cập nhật thống kê loại tài liệu:", statsError);
    }

    // Index vào Elasticsearch
    try {
      await updateESDocument(document._id.toString(), {
        status: "APPROVED",
        last_approved_at: current,
      });
    } catch (error) {
      console.error(
        `Lỗi cập nhật tài liệu ${document._id} trong Elasticsearch: ${error.message}`
      );
    }

    // Tính điểm cho user
    const isFirstApproval =
      (await ApprovalRequest.countDocuments({
        requester: approvalRequest.requester,
        status: "APPROVED",
        doc: { $ne: approvalRequest.doc },
      })) === 0;

    const base = isFirstApproval ? 20 : 15;
    const total = aiResult.is_intensive ? base + 5 : base;
    await earnPoints(
      user._id,
      total,
      `Đăng tài liệu ${document.title} (Tự động duyệt bởi AI)`
    );

    console.log(`Tự động duyệt thành công document ${document._id} bởi AI`);
  } catch (error) {
    console.error(`Lỗi khi tự động duyệt document ${document._id}:`, error);
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
  if (approvalRequest.status !== "PENDING")
    throw new Error("Yêu cầu phê duyệt đã được xử lý");
  
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
  document.approved_by_ai = false;
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

  if (
    document.description.summary_by_ai == undefined ||
    document.description.summary_by_ai.includes(
      "Tài liệu tương đồng cao",
      "Nội dung quá ngắn để thực hiện tóm tắt"
    )
  ) {
    try {
      const subject = await Subject.findById(document.subject);
      processCreateSummaryWithAI(
        approvalRequest._id,
        document,
        subject.name || ""
      );
    } catch (error) {
      console.error(
        `Lỗi khi xử lý tóm tắt cho document ${document._id}:`,
        error
      );
      // Không throw error để không ảnh hưởng đến việc duyệt tài liệu
    }
  }

  // Cập nhật thống kê loại tài liệu
  try {
    await updateDocumentTypeCount(user._id, document.doc_type);
  } catch (statsError) {
    console.error("Lỗi cập nhật thống kê loại tài liệu:", statsError);
  }

  // Cập nhật thống kê tài liệu được duyệt
  try {
    await updateDocumentApproved(document._id);
  } catch (statsError) {
    console.error("Lỗi cập nhật thống kê tài liệu được duyệt:", statsError);
  }

  // Cập nhật Elasticsearch
  try {
    await updateESDocument(document._id.toString(), {
      status: "APPROVED",
      last_approved_at: current,
    });
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

  // Gửi thông báo cộng điểm
  try {
    await notifyPointsEarned(
      user._id,
      total,
      `Đăng tài liệu "${document.title}"`
    );
  } catch (notificationError) {
    console.error("Lỗi gửi thông báo cộng điểm:", notificationError);
  }

  // Log activity
  await logActivity({
    userId: reviewerId,
    action: "APPROVAL_REQUEST_APPROVED",
    targetType: "Document",
    targetId: document._id,
    targetTitle: document.title,
    description: `Duyệt tài liệu "${document.title}"`,
    metadata: {
      requestId: approvalRequest._id,
      requesterId: user._id,
      isIntensive: isIntensive || false,
      pointsEarned: total,
    },
  });

  //gửi thông báo cho người đăng (để sau)

  return approvalRequest;
};

const processCreateSummaryWithAI = async (
  approvalRequestId,
  document,
  subjectName
) => {
  try {
    // Chỉ xử lý PDF và WORD
    if (!["PDF", "WORD"].includes(document.file_type)) {
      console.log(`Bỏ qua AI check cho file type: ${document.file_type}`);
      return;
    }

    const documentMetadata = {
      title: document.title,
      summary_by_user: document.description?.summary_by_user || "",
      author: document.author,
      publisher: document.publisher,
      published_year: document.published_year,
      keyword: document.keyword,
      subject_name: subjectName || "",
    };

    // Gọi Gemini AI - pass metadata để kiểm tra
    const result = await processDocumentWithGeminiAI(
      document.url,
      document.file_type,
      documentMetadata
    );

    // chỉ lưu tóm tắt
    const doc = await Document.findById(document._id);
    if (doc) {
      if (!doc.description) {
        doc.description = {};
      }
      doc.description.summary_by_ai = result.summary;
      await doc.save();
    }
  } catch (error) {
    console.error(`Lỗi trong processDocumentWithAI:`, error);
    // Fallback logic
    try {
      const approvalRequest = await ApprovalRequest.findById(approvalRequestId);
      if (approvalRequest) {
        approvalRequest.ai_checked = true;
        approvalRequest.ai_violation_level = "NONE";
        approvalRequest.ai_action_suggest = "MANUAL_REVIEW";
        approvalRequest.ai_reason = `Lỗi khi xử lý AI: ${error.message}`;
        await approvalRequest.save();
      }
    } catch (updateError) {
      console.error("Lỗi khi cập nhật approval request:", updateError);
    }
  }
};

const rejectRequest = async (requestId, reviewerId, message) => {
  const reviewer = await User.findById(reviewerId);
  if (!reviewer) throw new Error("Người duyệt không tồn tại");

  const approvalRequest = await ApprovalRequest.findById(requestId);
  if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");
  if (approvalRequest.status !== "PENDING")
    throw new Error("Yêu cầu phê duyệt đã được xử lý");
  
  const current = new Date();
  approvalRequest.reviewed_by = reviewer._id;
  approvalRequest.reviewed_at = current;
  approvalRequest.status = "REJECTED";
  approvalRequest.message = message;
  approvalRequest.expiredAt = current + 5 * 24 * 60 * 60 * 1000;
  await approvalRequest.save();

  const document = await Document.findById(approvalRequest.doc);
  if (!document) throw new Error("Tài liệu không tồn tại");

  // Reject document
  document.status = "REJECTED";
  document.approved_by_ai = false;
  document.is_deleted = true;
  document.expiredAt = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  document.is_delete_by_admin = true;
  document.delete_by_admin = reviewer._id;
  document.delete_by_admin_reason = message;
  document.delete_by_admin_at = current;
  await document.save();

  try {
    await deleteESDocument(document._id.toString());
  } catch (error) {
    console.error(
      `Lỗi xóa tài liệu ${document._id} trong Elasticsearch: ${error.message}`
    );
  }

  // Log activity
  await logActivity({
    userId: reviewerId,
    action: "APPROVAL_REQUEST_REJECTED",
    targetType: "Document",
    targetId: document._id,
    targetTitle: document.title,
    description: `Từ chối tài liệu "${document.title}"`,
    metadata: {
      requestId: approvalRequest._id,
      requesterId: approvalRequest.requester,
      rejectReason: message,
    },
  });

  //gửi thông báo cho người đăng (để sau)

  return approvalRequest;
};

const requestEdit = async (requestId, reviewerId, message) => {
  const reviewer = await User.findById(reviewerId);
  if (!reviewer) throw new Error("Người duyệt không tồn tại");

  const approvalRequest = await ApprovalRequest.findById(requestId);
  if (!approvalRequest) throw new Error("Yêu cầu phê duyệt không tồn tại");
  if (approvalRequest.status !== "PENDING")
    throw new Error("Yêu cầu phê duyệt đã được xử lý");

  const current = new Date();
  approvalRequest.reviewed_by = reviewer._id;
  approvalRequest.reviewed_at = current;
  approvalRequest.status = "REJECTED";
  approvalRequest.message = message;
  await approvalRequest.save();

  const document = await Document.findById(approvalRequest.doc);
  if (!document) throw new Error("Tài liệu không tồn tại");

  document.status = "REQUESTED_EDIT";
  document.approved_by_ai = false;
  await document.save();

  return approvalRequest;
};

const getEligibleApprovers = async (documentOrganizationId) => {
  try {
    // Lấy tất cả assignment active
    const allAssignments = await Assignment.find({ is_active: true })
      .populate({
        path: "role",
        select: "_id code permissions",
      })
      .populate({
        path: "account",
        select: "_id user",
        populate: {
          path: "user",
          select: "_id",
        },
      });

    const eligibleUserIds = new Set();

    for (const assignment of allAssignments) {
      const role = assignment.role;
      if (!role) continue;

      // Kiểm tra quyền MANAGE_DOCUMENT hoặc ALL
      const hasDocumentPermission =
        role.permissions.includes("MANAGE_DOCUMENT") ||
        role.permissions.includes("ALL");

      if (!hasDocumentPermission) continue;

      const user = assignment.account?.user;
      if (!user) continue;

      // Nếu có quyền ALL, có thể duyệt tất cả
      if (role.permissions.includes("ALL")) {
        eligibleUserIds.add(user._id.toString());
        continue;
      }

      // Nếu có quyền MANAGE_DOCUMENT
      // Kiểm tra organization assignment
      const assignmentOrgId = assignment.organization?.toString();

      // Nếu assignment không có organization cụ thể (null), admin này có thể duyệt tất cả document
      if (!assignmentOrgId) {
        eligibleUserIds.add(user._id.toString());
        continue;
      }

      // Nếu assignment có organization cụ thể
      // Nếu document không có organization, admin có organization cụ thể không duyệt được
      if (!documentOrganizationId) {
        continue;
      }

      // Nếu assignment có organization cụ thể, chỉ duyệt được document của organization đó
      if (assignmentOrgId === documentOrganizationId.toString()) {
        eligibleUserIds.add(user._id.toString());
      }
    }

    return Array.from(eligibleUserIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
  } catch (error) {
    console.error("Lỗi khi lấy danh sách admin có thể duyệt:", error);
    throw new Error(
      `Lỗi khi lấy danh sách admin có thể duyệt: ${error.message}`
    );
  }
};

// gán request cho admin có ít pending nhất
const assignApprovalRequest = async (
  approvalRequestId,
  documentOrganizationId
) => {
  try {
    // Lấy danh sách admin có thể duyệt
    const eligibleUserIds = await getEligibleApprovers(documentOrganizationId);

    // ko có admin -> gán null. assigned_to sẽ là null
    if (eligibleUserIds.length === 0) {
      return null;
    }

    const pendingCounts = await ApprovalRequest.aggregate([
      {
        $match: {
          assigned_to: { $in: eligibleUserIds },
          status: "PENDING",
        },
      },
      {
        $group: {
          _id: "$assigned_to",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: 1 },
      },
    ]);

    const countsByUser = {};

    eligibleUserIds.forEach((id) => {
      countsByUser[id.toString()] = 0;
    });

    pendingCounts.forEach((item) => {
      countsByUser[item._id.toString()] = item.count;
    });

    const minCount = Math.min(...Object.values(countsByUser));
    const candidates = eligibleUserIds.filter(
      (id) => countsByUser[id.toString()] === minCount
    );
    const selectedUserId =
      candidates[Math.floor(Math.random() * candidates.length)];

    // Cập nhật approval request với assigned_to
    await ApprovalRequest.findByIdAndUpdate(
      approvalRequestId,
      {
        assigned_to: selectedUserId,
      },
      { new: true }
    );

    return selectedUserId;
  } catch (error) {
    console.error("Lỗi khi gán approval request:", error);
    throw new Error(`Lỗi khi gán approval request: ${error.message}`);
  }
};

module.exports = {
  createApprovalRequest,
  getPendingRequestsByDocument,
  approveRequest,
  rejectRequest,
  requestEdit,
  processDocumentWithAI,
  getEligibleApprovers,
  assignApprovalRequest,
};