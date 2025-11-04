const RecentActivity = require("../models/recent_activities.model");
const User = require("../models/user.model");
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

    const activity = await RecentActivity.createActivity(activityData);
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
    const activities = await RecentActivity.getRecentActivities(limit);
    return activities.map((activity) => ({
      id: activity._id,
      type: activity.type,
      description: activity.description,
      actor: {
        name: activity.actor.name,
        role: activity.actor.role,
        avatar: activity.actor.user?.avatar,
      },
      target: activity.target,
      color: activity.color,
      icon: activity.icon,
      createdAt: activity.createdAt,
    }));
  } catch (error) {
    console.error("Error getting recent activities:", error);
    throw new Error("Lỗi khi lấy hoạt động gần đây: " + error.message);
  }
};

// Các hàm helper để tạo hoạt động cụ thể
const logDocumentApproved = async (documentId, approvedBy) => {
  try {
    const document = await Document.findById(documentId).select("title");
    if (!document) return;

    await createActivity({
      type: "DOCUMENT_APPROVED",
      description: `Tài liệu "${document.title}" đã được duyệt`,
      actor: {
        user: approvedBy,
        role: "ADMIN",
      },
      target: {
        type: "DOCUMENT",
        id: documentId,
        name: document.title,
      },
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

    await createActivity({
      type: "DOCUMENT_EDIT_REQUESTED",
      description: `Yêu cầu chỉnh sửa tài liệu "${document.title}"`,
      actor: {
        user: requestedBy,
        role: "ADMIN",
      },
      target: {
        type: "DOCUMENT",
        id: documentId,
        name: document.title,
      },
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

    await createActivity({
      type: "DOCUMENT_DELETED",
      description: `Tài liệu "${document.title}" đã bị xóa`,
      actor: {
        user: deletedBy,
        role: "ADMIN",
      },
      target: {
        type: "DOCUMENT",
        id: documentId,
        name: document.title,
      },
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

    await createActivity({
      type: "DOCUMENT_UPLOADED",
      description: `Tài liệu mới "${document.title}" được tải lên`,
      actor: {
        user: uploadedBy,
      },
      target: {
        type: "DOCUMENT",
        id: documentId,
        name: document.title,
      },
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

    await createActivity({
      type: "USER_CREATED",
      description: `Người dùng mới: ${userName}`,
      actor: createdBy
        ? {
            user: createdBy,
            role: "ADMIN",
          }
        : {
            user: userId,
            name: userName,
          },
      target: {
        type: "USER",
        id: userId,
        name: userName,
      },
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

    await createActivity({
      type: "ORGANIZATION_CREATED",
      description: `Trường mới "${organization.name}" được tạo`,
      actor: {
        user: createdBy,
      },
      target: {
        type: "ORGANIZATION",
        id: organizationId,
        name: organization.name,
      },
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

    await createActivity({
      type: "SUBJECT_CREATED",
      description: `Môn học mới "${subject.name}" được thêm`,
      actor: {
        user: createdBy,
      },
      target: {
        type: "SUBJECT",
        id: subjectId,
        name: subject.name,
      },
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

    await createActivity({
      type: "USER_BANNED",
      description: `Người dùng ${userName} đã bị cấm`,
      actor: {
        user: bannedBy,
        role: "ADMIN",
      },
      target: {
        type: "USER",
        id: userId,
        name: userName,
      },
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

    await createActivity({
      type: "USER_UNBANNED",
      description: `Người dùng ${userName} được bỏ cấm`,
      actor: {
        user: unbannedBy,
        role: "ADMIN",
      },
      target: {
        type: "USER",
        id: userId,
        name: userName,
      },
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

    await createActivity({
      type: "REPORT_RESOLVED",
      description: `Báo cáo vi phạm ${report.type} đã được xử lý`,
      actor: {
        user: resolvedBy,
        role: "ADMIN",
      },
      target: {
        type: "REPORT",
        id: reportId,
      },
      color: "success",
      icon: "check",
    });
  } catch (error) {
    console.error("Error logging report resolved:", error);
  }
};

module.exports = {
  createActivity,
  getRecentActivities,
  logDocumentApproved,
  logDocumentEditRequested,
  logDocumentDeleted,
  logDocumentUploaded,
  logUserCreated,
  logOrganizationCreated,
  logSubjectCreated,
  logUserBanned,
  logUserUnbanned,
  logReportResolved,
};
