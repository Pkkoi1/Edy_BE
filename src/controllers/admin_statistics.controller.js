const {
  getStatistics,
  refreshStatistics,
  getAdminTasks,
  getRecentActivitiesForAdmin,
} = require("../services/admin_statistics.service");

exports.refreshStatistics = async (req, res) => {
  try {
    const result = await refreshStatistics();

    res.json({
      success: true,
      data: result.data,
      message: result.message,
      last_updated: result.last_updated,
    });
  } catch (error) {
    console.error("Error in refreshStatistics controller:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { force_refresh = false } = req.query;
    const forceRefresh = force_refresh === "true";

    const statsResult = await getStatistics(forceRefresh);

    // Transform data for dashboard format
    const stats = statsResult.data;

    const dashboardStats = {
      total_documents: stats.total_documents,
      pending_documents: stats.pending_documents,
      total_users: stats.total_users,
      total_downloads: stats.total_downloads,
      total_views: stats.total_views,
      total_organizations: stats.total_organizations,
      total_reports: stats.total_reports,
      banned_users: stats.banned_users,
      // Additional useful stats
      approved_documents: stats.approved_documents,
      active_users: stats.active_users,
      pending_reports: stats.pending_reports,
      total_subjects: stats.total_subjects,
    };

    // Get recent activities
    const activitiesResult = await getRecentActivitiesForAdmin(10);

    // Get admin tasks
    const adminId = req.user.userId;
    const tasks = await getAdminTasks(adminId, 20);

    res.json({
      success: true,
      data: {
        statistics: dashboardStats,
        recent_activities: activitiesResult.activities,
        tasks: tasks,
      },
      cached: statsResult.cached,
      last_updated: statsResult.last_updated,
    });
  } catch (error) {
    console.error("Error in getDashboardStats controller:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getRecentActivities = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Validate limit
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit phải là số từ 1 đến 50",
      });
    }

    const activitiesResult = await getRecentActivitiesForAdmin(limitNum);

    res.json({
      success: true,
      data: activitiesResult.activities,
    });
  } catch (error) {
    console.error("Error in getRecentActivities controller:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
