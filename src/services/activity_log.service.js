const ActivityLog = require("../models/activity_log.model");
const User = require("../models/user.model");
const Account = require("../models/account.model");
const Role = require("../models/role.model");
const Document = require("../models/document.model");
const Organization = require("../models/organization.model");
const Subject = require("../models/subject.model");

// Tạo hoạt động mới
const createActivity = async (activityData) => {
  try {
    // Lấy thông tin actor nếu chưa có
    if (!activityData.actor.name && activityData.actor.user) {
      const user = await User.findById(activityData.actor.user).select(
        "first_name last_name"
      );
      if (user) {
        activityData.actor.name = `${user.first_name} ${user.last_name}`;
      }
    }

    const activity = await ActivityLog.createActivity(activityData);
    return activity;
  } catch (error) {
    console.error("Error creating activity:", error);
    // Không throw error để không làm gián đoạn flow chính
    return null;
  }
};

// Lấy danh sách hoạt động gần đây
const getRecentActivities = async (limit = 10) => {
  try {
    const activities = await ActivityLog.getRecentActivities(limit);

    return {
      success: true,
      activities: activities, // Return activities with populated user field directly
      total: activities.length,
    };
  } catch (error) {
    console.error("Error getting recent activities:", error);
    throw new Error("Lỗi khi lấy hoạt động gần đây: " + error.message);
  }
};

// Generic logActivity function for flexible activity logging
const logActivity = async ({
  userId,
  action,
  targetType,
  targetId,
  targetTitle,
  description,
  metadata = {},
}) => {
  try {
    // Determine color and icon based on action
    const getActivityStyle = (action) => {
      const styles = {
        APPROVAL_REQUEST_CREATED: { color: "info", icon: "plus-circle" },
        APPROVAL_REQUEST_APPROVED: { color: "success", icon: "check-circle" },
        APPROVAL_REQUEST_REJECTED: { color: "danger", icon: "x-circle" },
        DOCUMENT_CREATED: { color: "info", icon: "file-plus" },
        DOCUMENT_APPROVED: { color: "success", icon: "check-circle" },
        DOCUMENT_REJECTED: { color: "danger", icon: "x-circle" },
        DOCUMENT_DELETED: { color: "danger", icon: "trash" },
        DOCUMENT_EDITED: { color: "info", icon: "edit" },
        DOCUMENT_UPLOADED: { color: "info", icon: "upload" },
        EDIT_REQUEST_CREATED: { color: "warning", icon: "edit" },
        EDIT_REQUEST_APPROVED: { color: "success", icon: "check-circle" },
        EDIT_REQUEST_REJECTED: { color: "danger", icon: "x-circle" },
        REPORT_CREATED: { color: "warning", icon: "alert-triangle" },
        REPORT_RESOLVED: { color: "success", icon: "check" },
        REPORT_DISMISSED: { color: "secondary", icon: "x" },
        COMMENT_CREATED: { color: "info", icon: "message-circle" },
        COMMENT_DELETED: { color: "danger", icon: "message-circle" },
        USER_CREATED: { color: "success", icon: "user-plus" },
        USER_BANNED: { color: "danger", icon: "ban" },
        USER_UNBANNED: { color: "success", icon: "unlock" },
        USER_STATUS_CHANGED: { color: "warning", icon: "user-check" },
        USER_ROLES_ASSIGNED: { color: "success", icon: "user-plus" },
        USER_ROLES_REVOKED: { color: "warning", icon: "user-minus" },
        ORGANIZATION_CREATED: { color: "info", icon: "building" },
        ORGANIZATION_UPDATED: { color: "info", icon: "building" },
        SUBJECT_CREATED: { color: "info", icon: "book" },
        SUBJECT_UPDATED: { color: "info", icon: "book" },
      };
      return styles[action] || { color: "info", icon: "activity" };
    };

    const style = getActivityStyle(action);

    // Create activity directly with the correct field names for the ActivityLog model
    await ActivityLog.create({
      user: userId,
      action: action,
      target_type: targetType,
      target_id: targetId,
      target_title: targetTitle,
      description: description,
      color: style.color,
      icon: style.icon,
      metadata: metadata,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw error to avoid disrupting main flow
  }
};

// Các hàm helper để tạo hoạt động cụ thể
const logDocumentApproved = async (documentId, approvedBy) => {
  try {
    const document = await Document.findById(documentId).select("title");
    if (!document) return;

    await ActivityLog.create({
      user: approvedBy,
      action: "DOCUMENT_APPROVED",
      target_type: "Document",
      target_id: documentId,
      target_title: document.title,
      description: `Tài liệu "${document.title}" đã được duyệt`,
      color: "success",
      icon: "check-circle",
    });
  } catch (error) {
    console.error("Error logging document approved:", error);
  }
};

const logDocumentEditRequested = async (documentId, requestedBy) => {
  try {
    const document = await Document.findById(documentId).select("title");
    if (!document) return;

    await ActivityLog.create({
      user: requestedBy,
      action: "DOCUMENT_EDIT_REQUESTED",
      target_type: "Document",
      target_id: documentId,
      target_title: document.title,
      description: `Yêu cầu chỉnh sửa tài liệu "${document.title}"`,
      color: "warning",
      icon: "edit",
    });
  } catch (error) {
    console.error("Error logging document edit requested:", error);
  }
};

const logDocumentDeleted = async (documentId, deletedBy) => {
  try {
    const document = await Document.findById(documentId).select("title");
    if (!document) return;

    await ActivityLog.create({
      user: deletedBy,
      action: "DOCUMENT_DELETED",
      target_type: "Document",
      target_id: documentId,
      target_title: document.title,
      description: `Tài liệu "${document.title}" đã bị xóa`,
      color: "danger",
      icon: "trash",
    });
  } catch (error) {
    console.error("Error logging document deleted:", error);
  }
};

const logDocumentUploaded = async (documentId, uploadedBy) => {
  try {
    const document = await Document.findById(documentId).select("title");
    if (!document) return;

    await ActivityLog.create({
      user: uploadedBy,
      action: "DOCUMENT_UPLOADED",
      target_type: "Document",
      target_id: documentId,
      target_title: document.title,
      description: `Tài liệu mới "${document.title}" được tải lên`,
      color: "info",
      icon: "upload",
    });
  } catch (error) {
    console.error("Error logging document uploaded:", error);
  }
};

const logUserCreated = async (userId, createdBy = null) => {
  try {
    const user = await User.findById(userId).select("first_name last_name");
    if (!user) return;

    const userName = `${user.first_name} ${user.last_name}`;

    await ActivityLog.create({
      user: createdBy || userId,
      action: "USER_CREATED",
      target_type: "User",
      target_id: userId,
      target_title: userName,
      description: `Người dùng mới: ${userName}`,
      color: "success",
      icon: "user-plus",
    });
  } catch (error) {
    console.error("Error logging user created:", error);
  }
};

const logOrganizationCreated = async (organizationId, createdBy) => {
  try {
    const organization = await Organization.findById(organizationId).select(
      "name"
    );
    if (!organization) return;

    await ActivityLog.create({
      user: createdBy,
      action: "ORGANIZATION_CREATED",
      target_type: "Organization",
      target_id: organizationId,
      target_title: organization.name,
      description: `Trường mới "${organization.name}" được tạo`,
      color: "info",
      icon: "building",
    });
  } catch (error) {
    console.error("Error logging organization created:", error);
  }
};

const logSubjectCreated = async (subjectId, createdBy) => {
  try {
    const subject = await Subject.findById(subjectId).select("name");
    if (!subject) return;

    await ActivityLog.create({
      user: createdBy,
      action: "SUBJECT_CREATED",
      target_type: "Subject",
      target_id: subjectId,
      target_title: subject.name,
      description: `Môn học mới "${subject.name}" được thêm`,
      color: "info",
      icon: "book",
    });
  } catch (error) {
    console.error("Error logging subject created:", error);
  }
};

const logUserBanned = async (userId, bannedBy) => {
  try {
    const user = await User.findById(userId).select("first_name last_name");
    if (!user) return;

    const userName = `${user.first_name} ${user.last_name}`;

    // Tìm userId thực sự của người thực hiện hành động
    const bannedByAccount = await Account.findById(bannedBy);
    if (!bannedByAccount) return;

    await ActivityLog.create({
      user: bannedByAccount.user,
      action: "USER_BANNED",
      target_type: "User",
      target_id: userId,
      target_title: userName,
      description: `Người dùng ${userName} đã bị cấm`,
      color: "danger",
      icon: "ban",
    });
  } catch (error) {
    console.error("Error logging user banned:", error);
  }
};

const logUserUnbanned = async (userId, unbannedBy) => {
  try {
    const user = await User.findById(userId).select("first_name last_name");
    if (!user) return;

    const userName = `${user.first_name} ${user.last_name}`;

    // Tìm userId thực sự của người thực hiện hành động
    const unbannedByAccount = await Account.findById(unbannedBy);
    if (!unbannedByAccount) return;

    await ActivityLog.create({
      user: unbannedByAccount.user,
      action: "USER_UNBANNED",
      target_type: "User",
      target_id: userId,
      target_title: userName,
      description: `Người dùng ${userName} được bỏ cấm`,
      color: "success",
      icon: "unlock",
    });
  } catch (error) {
    console.error("Error logging user unbanned:", error);
  }
};

const logReportResolved = async (reportId, resolvedBy) => {
  try {
    // Assuming Report model exists
    const Report = require("../models/report.model");
    const report = await Report.findById(reportId).select("type");
    if (!report) return;

    // Tìm userId thực sự của người thực hiện hành động
    const resolvedByAccount = await Account.findById(resolvedBy);
    if (!resolvedByAccount) return;

    await ActivityLog.create({
      user: resolvedByAccount.user,
      action: "REPORT_RESOLVED",
      target_type: "Report",
      target_id: reportId,
      target_title: report.type || "",
      description: `Báo cáo vi phạm ${report.type} đã được xử lý`,
      color: "success",
      icon: "check",
    });
  } catch (error) {
    console.error("Error logging report resolved:", error);
  }
};

const logDocumentEdited = async (documentId, editedBy) => {
  try {
    const document = await Document.findById(documentId).select("title");
    if (!document) return;

    await ActivityLog.create({
      user: editedBy,
      action: "DOCUMENT_EDITED",
      target_type: "Document",
      target_id: documentId,
      target_title: document.title,
      description: `Tài liệu "${document.title}" đã được chỉnh sửa`,
      color: "info",
      icon: "edit",
    });
  } catch (error) {
    console.error("Error logging document edited:", error);
  }
};

const logEditApprovalApproved = async (editApprovalId, approvedBy) => {
  try {
    const editApproval = await require("../models/edit_approval.model")
      .findById(editApprovalId)
      .populate("edit_doc");
    if (!editApproval || !editApproval.edit_doc) return;

    const document = await Document.findById(
      editApproval.edit_doc.original_document
    ).select("title");
    if (!document) return;

    await ActivityLog.create({
      user: approvedBy,
      action: "EDIT_APPROVAL_APPROVED",
      target_type: "Document",
      target_id: editApproval.edit_doc.original_document,
      target_title: document.title,
      description: `Yêu cầu chỉnh sửa tài liệu "${document.title}" đã được duyệt`,
      color: "success",
      icon: "check-circle",
    });
  } catch (error) {
    console.error("Error logging edit approval approved:", error);
  }
};

const logEditApprovalRejected = async (editApprovalId, rejectedBy) => {
  try {
    const editApproval = await require("../models/edit_approval.model")
      .findById(editApprovalId)
      .populate("edit_doc");
    if (!editApproval || !editApproval.edit_doc) return;

    const document = await Document.findById(
      editApproval.edit_doc.original_document
    ).select("title");
    if (!document) return;

    await ActivityLog.create({
      user: rejectedBy,
      action: "EDIT_APPROVAL_REJECTED",
      target_type: "Document",
      target_id: editApproval.edit_doc.original_document,
      target_title: document.title,
      description: `Yêu cầu chỉnh sửa tài liệu "${document.title}" đã bị từ chối`,
      color: "danger",
      icon: "x-circle",
    });
  } catch (error) {
    console.error("Error logging edit approval rejected:", error);
  }
};

const logUserRolesRevoked = async (accountId, revokedBy) => {
  try {
    // Tìm Account của người bị gỡ quyền để lấy thông tin user
    const account = await Account.findById(accountId);
    if (!account) return;

    const user = await User.findById(account.user).select(
      "first_name last_name"
    );
    if (!user) return;

    // Tìm Account của người thực hiện hành động để lấy userId thực sự
    const revokedByAccount = await Account.findById(revokedBy);
    if (!revokedByAccount) return;

    const userName = `${user.first_name} ${user.last_name}`;

    await ActivityLog.create({
      user: revokedByAccount.user, // Lưu userId thực sự của người thực hiện
      action: "USER_ROLES_REVOKED",
      target_type: "User",
      target_id: accountId,
      target_title: userName,
      description: `Tất cả vai trò của người dùng ${userName} đã bị gỡ`,
      color: "warning",
      icon: "user-minus",
    });
    console.log("Logged user roles revoked activity for", userName);
  } catch (error) {
    console.error("Error logging user roles revoked:", error);
  }
};

const logUserRolesAssigned = async (accountId, roleId, assignedBy) => {
  try {
    // Tìm Account của người được gán quyền để lấy thông tin user
    const account = await Account.findById(accountId);
    if (!account) return;

    const user = await User.findById(account.user).select(
      "first_name last_name"
    );
    if (!user) return;

    // Tìm thông tin role
    const role = await Role.findById(roleId).select("name");
    if (!role) return;

    // Tìm Account của người thực hiện hành động để lấy userId thực sự
    const assignedByAccount = await Account.findById(assignedBy);
    if (!assignedByAccount) return;

    const userName = `${user.first_name} ${user.last_name}`;

    await ActivityLog.create({
      user: assignedByAccount.user, // Lưu userId thực sự của người thực hiện
      action: "USER_ROLES_ASSIGNED",
      target_type: "User",
      target_id: accountId,
      target_title: userName,
      description: `Người dùng ${userName} đã được gán vai trò "${role.name}"`,
      color: "success",
      icon: "user-plus",
    });
    console.log(
      "Logged user roles assigned activity for",
      userName,
      "with role",
      role.name
    );
  } catch (error) {
    console.error("Error logging user roles assigned:", error);
  }
};

module.exports = {
  createActivity,
  getRecentActivities,
  logActivity,
  logDocumentApproved,
  logDocumentEditRequested,
  logDocumentEdited,
  logEditApprovalApproved,
  logEditApprovalRejected,
  logDocumentDeleted,
  logDocumentUploaded,
  logUserCreated,
  logOrganizationCreated,
  logSubjectCreated,
  logUserBanned,
  logUserUnbanned,
  logReportResolved,
  logUserRolesRevoked,
  logUserRolesAssigned,
};
