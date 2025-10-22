const {
  getPointHistoryByUserId,
} = require("../services/point_transaction.service");

exports.getPointHistoryByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "Vui lòng cung cấp userId" });
    }

    const result = await getPointHistoryByUserId(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    if (result.error) {
      return res.status(500).json({ message: result.error });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in getPointHistoryByUserId controller:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy lịch sử tích điểm" });
  }
};
