const mongoose = require("mongoose");

const userStatisticsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },

    // Thống kê tổng quan
    totalUploads: { type: Number, default: 0 },
    totalContributions: { type: Number, default: 0 }, // Tổng điểm đóng góp
    totalComments: { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 }, // Tổng lượt tải tài liệu của user

    // Thống kê theo loại tài liệu
    documentTypes: {
      RESEARCH_REPORT: { type: Number, default: 0 },
      VIDEO: { type: Number, default: 0 },
      STUDY_GUIDE: { type: Number, default: 0 },
      TEXTBOOK: { type: Number, default: 0 },
      ESSAY: { type: Number, default: 0 },
      SOLUTION_SET: { type: Number, default: 0 },
      THESIS: { type: Number, default: 0 },
      LECTURE: { type: Number, default: 0 },
      OTHER: { type: Number, default: 0 },
    },

    // Lịch sử điểm từ point_transaction
    pointHistory: {
      1: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      2: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      3: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      4: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      5: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      6: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      7: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      8: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      9: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      10: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      11: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
      12: {
        earned: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
      },
    },

    // Top 3 tài liệu tiêu biểu
    topDocuments: [
      {
        document: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
        title: { type: String },
        views: { type: Number, default: 0 },
        downloads: { type: Number, default: 0 },
        rating: { type: Number, default: 0 }, // Tính theo (like/(like+dislike))*100
      },
    ],

    // Vi phạm theo tháng từ violation_log
    monthlyViolations: {
      1: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      2: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      3: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      4: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      5: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      6: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      7: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      8: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      9: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      10: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      11: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
      12: {
        SPAM_OR_MISLEADING: { type: Number, default: 0 },
        DUPLICATE: { type: Number, default: 0 },
        COPYRIGHT: { type: Number, default: 0 },
        INCORRECT_CATEGORY: { type: Number, default: 0 },
        PERSONAL_INFORMATION: { type: Number, default: 0 },
        LOW_QUALITY: { type: Number, default: 0 },
        INAPPROPRIATE: { type: Number, default: 0 },
        OTHER: { type: Number, default: 0 },
      },
    },

    // Timestamp cập nhật cuối cùng
    lastSyncAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Compound index để đảm bảo mỗi user chỉ có 1 thống kê cho mỗi năm
userStatisticsSchema.index({ user: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("UserStatistics", userStatisticsSchema);
