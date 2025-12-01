const mongoose = require("mongoose");

const adminStatisticsSchema = new mongoose.Schema(
  {
    // Tổng tài liệu
    total_documents: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tài liệu chờ duyệt
    pending_documents: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tài liệu đã duyệt
    approved_documents: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tài liệu bị từ chối
    rejected_documents: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tổng người dùng
    total_users: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Người dùng active
    active_users: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Người dùng inactive
    inactive_users: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Người dùng bị cấm
    banned_users: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tổng lượt tải xuống
    total_downloads: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tổng lượt xem
    total_views: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tổng tổ chức
    total_organizations: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tổng báo cáo
    total_reports: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Báo cáo chưa xử lý
    pending_reports: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Báo cáo đã xử lý
    resolved_reports: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tổng môn học
    total_subjects: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tổng điểm thưởng
    total_points: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Thống kê theo thời gian
    last_updated: {
      type: Date,
      default: Date.now,
    },

    // Cache duration (minutes)
    cache_duration: {
      type: Number,
      default: 5, // 5 minutes cache
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get current statistics
adminStatisticsSchema.statics.getCurrentStats = async function () {
  let stats = await this.findOne().sort({ createdAt: -1 });

  // If no stats exist or cache is expired, return null to trigger recalculation
  if (!stats || this.isCacheExpired(stats)) {
    return null;
  }

  return stats;
};

// Check if cache is expired
adminStatisticsSchema.statics.isCacheExpired = function (stats) {
  if (!stats) return true;
  const now = new Date();
  const lastUpdated = new Date(stats.last_updated);
  const cacheDuration = stats.cache_duration * 60 * 1000; // Convert to milliseconds
  return now - lastUpdated > cacheDuration;
};

// Method to update statistics
adminStatisticsSchema.methods.updateStats = async function (newStats) {
  Object.assign(this, newStats);
  this.last_updated = new Date();
  return this.save();
};

module.exports = mongoose.model("AdminStatistics", adminStatisticsSchema);
