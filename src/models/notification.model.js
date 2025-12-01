const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    cmt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "APPROVED",
        "REMOVED",
        "REJECTED",
        "HIDDEN",
        "SYSTEM",
        "COMMENT",
        "REPLY",
        "ACCESS_REQUEST",
        "ACCESS_GRANTED",
        "ACCESS_DENIED",
        "POINTS_EARNED",
        "POINTS_DEDUCTED",
        "USER_BANNED",
      ],
      required: true,
    },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    // Trường điều hướng
    redirectTo: {
      type: String,
      enum: ["DOCUMENT", "COMMENT", "USER", "SYSTEM", "POINT", "NONE"],
      default: "NONE",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
