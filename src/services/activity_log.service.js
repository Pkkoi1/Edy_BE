const ActivityLog = require("../models/activity_log.model");

/**
 * Ghi log hoạt động của user
 * @param {Object} params - Thông tin hoạt động
 * @param {String} params.userId - ID của user thực hiện hành động
 * @param {String} params.action - Loại hành động (enum từ ActivityLog model)
 * @param {String} params.targetType - Loại đối tượng bị tác động
 * @param {String} params.targetId - ID của đối tượng bị tác động
 * @param {String} params.targetTitle - Tên/tiêu đề của đối tượng (optional)
 * @param {String} params.description - Mô tả hành động
 * @param {Object} params.metadata - Dữ liệu bổ sung (optional)
 */
const logActivity = async ({
  userId,
  action,
  targetType,
  targetId,
  targetTitle = null,
  description,
  metadata = {},
}) => {
  try {
    const activityLog = new ActivityLog({
      user: userId,
      action,
      target_type: targetType,
      target_id: targetId,
      target_title: targetTitle,
      description,
      metadata,
    });

    await activityLog.save();
    return { success: true, log: activityLog };
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw error to prevent breaking main operations
    return { success: false, error: error.message };
  }
};

/**
 * Lấy danh sách hoạt động gần đây
 * @param {Object} options - Tùy chọn filter
 * @param {Number} options.limit - Số lượng records (default: 50)
 * @param {String} options.userId - Filter theo user ID (optional)
 * @param {String} options.action - Filter theo loại hành động (optional)
 * @param {String} options.targetType - Filter theo loại đối tượng (optional)
 * @param {Date} options.startDate - Filter từ ngày (optional)
 * @param {Date} options.endDate - Filter đến ngày (optional)
 */
const getRecentActivities = async ({
  limit = 50,
  userId = null,
  action = null,
  targetType = null,
  startDate = null,
  endDate = null,
} = {}) => {
  try {
    const query = {};

    if (userId) query.user = userId;
    if (action) query.action = action;
    if (targetType) query.target_type = targetType;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const activities = await ActivityLog.find(query)
      .populate({
        path: "user",
        select: "first_name last_name avatar contact_email",
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      success: true,
      activities,
      total: activities.length,
    };
  } catch (error) {
    console.error("Error getting recent activities:", error);
    throw new Error("Lỗi khi lấy hoạt động gần đây: " + error.message);
  }
};

/**
 * Lấy hoạt động của một user cụ thể
 */
const getUserActivities = async (userId, limit = 50) => {
  return getRecentActivities({ userId, limit });
};

/**
 * Lấy thống kê hoạt động theo loại
 */
const getActivityStatistics = async (startDate = null, endDate = null) => {
  try {
    const matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const stats = await ActivityLog.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return {
      success: true,
      statistics: stats,
    };
  } catch (error) {
    console.error("Error getting activity statistics:", error);
    throw new Error("Lỗi khi lấy thống kê hoạt động: " + error.message);
  }
};

/**
 * Xóa log hoạt động cũ (để dọn dẹp database)
 * @param {Number} daysToKeep - Số ngày muốn giữ lại log (default: 90)
 */
const cleanupOldLogs = async (daysToKeep = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    return {
      success: true,
      deletedCount: result.deletedCount,
      message: `Đã xóa ${result.deletedCount} log cũ hơn ${daysToKeep} ngày`,
    };
  } catch (error) {
    console.error("Error cleaning up old logs:", error);
    throw new Error("Lỗi khi dọn dẹp log cũ: " + error.message);
  }
};

module.exports = {
  logActivity,
  getRecentActivities,
  getUserActivities,
  getActivityStatistics,
  cleanupOldLogs,
};
