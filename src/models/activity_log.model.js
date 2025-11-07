const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "DOCUMENT_CREATED",
        "DOCUMENT_APPROVED",
        "DOCUMENT_REJECTED",
        "DOCUMENT_DELETED",
        "DOCUMENT_EDITED",
        "DOCUMENT_HIDDEN",
        "EDIT_REQUEST_CREATED",
        "EDIT_REQUEST_APPROVED",
        "EDIT_REQUEST_REJECTED",
        "APPROVAL_REQUEST_CREATED",
        "APPROVAL_REQUEST_APPROVED",
        "APPROVAL_REQUEST_REJECTED",
        "REPORT_CREATED",
        "REPORT_RESOLVED",
        "REPORT_DISMISSED",
        "COMMENT_CREATED",
        "COMMENT_DELETED",
        "USER_BANNED",
        "USER_UNBANNED",
        "ORGANIZATION_CREATED",
        "ORGANIZATION_UPDATED",
        "SUBJECT_CREATED",
        "SUBJECT_UPDATED",
      ],
      required: true,
    },
    target_type: {
      type: String,
      enum: [
        "Document",
        "User",
        "Comment",
        "Report",
        "ApprovalRequest",
        "EditApproval",
        "Organization",
        "Subject",
      ],
      required: true,
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    target_title: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ target_type: 1, target_id: 1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
