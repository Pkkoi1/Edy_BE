const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    // Người thực hiện hoạt động
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Loại hành động
    action: {
      type: String,
      required: true,
      enum: [
        "APPROVAL_REQUEST_APPROVED",
        "APPROVAL_REQUEST_CREATED",
        "APPROVAL_REQUEST_REJECTED",
        "DOCUMENT_CREATED",
        "DOCUMENT_APPROVED",
        "DOCUMENT_REJECTED",
        "DOCUMENT_DELETED",
        "DOCUMENT_EDITED",
        "DOCUMENT_UPLOADED",
        "EDIT_REQUEST_CREATED",
        "EDIT_REQUEST_APPROVED",
        "EDIT_REQUEST_REJECTED",
        "REPORT_CREATED",
        "REPORT_RESOLVED",
        "REPORT_DISMISSED",
        "COMMENT_CREATED",
        "COMMENT_DELETED",
        "USER_CREATED",
        "USER_BANNED",
        "USER_UNBANNED",
        "USER_STATUS_CHANGED",
        "USER_ROLES_ASSIGNED",
        "USER_ROLES_REVOKED",
        "ORGANIZATION_CREATED",
        "SUBJECT_CREATED",
      ],
    },

    // Loại đối tượng bị ảnh hưởng
    target_type: {
      type: String,
      required: true,
      enum: [
        "Document",
        "User",
        "Organization",
        "Subject",
        "Report",
        "ApprovalRequest",
        "Comment",
      ],
    },

    // ID của đối tượng bị ảnh hưởng
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Tên/tiêu đề của đối tượng (optional)
    target_title: {
      type: String,
      default: "",
    },

    // Mô tả hoạt động
    description: {
      type: String,
      required: true,
    },

    // Thông tin bổ sung
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Màu sắc cho UI
    color: {
      type: String,
      enum: ["success", "warning", "danger", "info"],
      default: "info",
    },

    // Icon cho UI
    icon: {
      type: String,
      default: "activity",
    },
  },
  {
    timestamps: true,
  }
);

// Index để query nhanh
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ target_type: 1, target_id: 1 });

// Static method để tạo hoạt động mới
activityLogSchema.statics.createActivity = async function (activityData) {
  const activity = new this(activityData);
  await activity.save();
  return activity;
};

// Static method để lấy hoạt động gần đây
activityLogSchema.statics.getRecentActivities = async function (limit = 10) {
  return this.find()
    .populate("user", "first_name last_name avatar contact_email")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Method để format cho frontend
activityLogSchema.methods.toDisplayFormat = function () {
  return {
    id: this._id,
    action: this.action,
    description: this.description,
    actor: {
      user: this.user,
      name: this.user
        ? `${this.user.first_name} ${this.user.last_name}`
        : "Unknown User",
      role: "USER",
      avatar: this.user?.avatar,
    },
    target: {
      type: this.target_type,
      id: this.target_id,
      name: this.target_title,
    },
    color: this.color,
    icon: this.icon,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("ActivityLog", activityLogSchema);
