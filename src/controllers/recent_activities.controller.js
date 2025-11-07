const {
  getRecentActivities,
} = require("../services/recent_activities.service");

exports.getRecentActivities = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Validate limit
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit phải là số nguyên trong khoảng 1-50",
      });
    }

    const activities = await getRecentActivities(limitNum);

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Error in getRecentActivities controller:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
