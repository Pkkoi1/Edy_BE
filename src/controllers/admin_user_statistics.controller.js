const {
  getStatistics,
  getUsersList,
  syncStatistics,
} = require("../services/admin_user_statistics.service");

exports.getAdminUserStatistics = async (req, res) => {
  try {
    const { year, month } = req.query;
    const yearNum = year ? parseInt(year) : null;
    const monthNum = month ? parseInt(month) : null;

    const statistics = await getStatistics(yearNum, monthNum);

    // Nếu chỉ có year, trả về monthlyStats thay vì monthlyNewUsers
    if (yearNum && !monthNum) {
      res.json({
        year: statistics.year,
        stats: {
          totalUsers: statistics.totalUsers,
          activeUsers: statistics.activeUsers,
          inactiveUsers: statistics.inactiveUsers,
          bannedUsers: statistics.bannedUsers,
          newUsers: statistics.newUsers,
        },
        monthlyStats: statistics.monthlyStats,
      });
    } else {
      // Thống kê theo tháng
      res.json({
        year: statistics.year,
        month: statistics.month,
        stats: {
          totalUsers: statistics.totalUsers,
          activeUsers: statistics.activeUsers,
          inactiveUsers: statistics.inactiveUsers,
          bannedUsers: statistics.bannedUsers,
          newUsers: statistics.newUsers,
        },
        monthlyNewUsers: statistics.monthlyNewUsers,
      });
    }
  } catch (error) {
    console.error("Error getting admin user statistics:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy thống kê người dùng" });
  }
};

exports.getUsersList = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = "" } = req.query;

    const result = await getUsersList(
      parseInt(page),
      parseInt(limit),
      search.trim()
    );

    res.json(result);
  } catch (error) {
    console.error("Error getting users list:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy danh sách người dùng" });
  }
};

exports.syncAdminUserStatistics = async (req, res) => {
  try {
    const { year, month } = req.query;
    const yearNum = year ? parseInt(year) : null;
    const monthNum = month ? parseInt(month) : null;

    const result = await syncStatistics(yearNum, monthNum);

    // Nếu sync theo năm, response sẽ khác
    if (yearNum && !monthNum) {
      res.json({
        message: result.message,
        year: result.year,
        syncedMonths: result.syncedMonths,
      });
    } else {
      // Sync theo tháng
      res.json({
        message: "Đồng bộ thống kê người dùng thành công",
        year: result.year,
        month: result.month,
        lastSyncAt: result.updatedAt,
      });
    }
  } catch (error) {
    console.error("Error syncing admin user statistics:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đồng bộ thống kê" });
  }
};
