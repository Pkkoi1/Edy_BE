const {
  getPointHistoryByUserId,
  spendUserPoints,
} = require("../services/point_transaction.service");

exports.spendPoints = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Số điểm cần trừ phải lớn hơn 0",
      });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        message: "Lý do sử dụng điểm là bắt buộc",
      });
    }

    const result = await spendUserPoints(userId, amount, reason.trim());

    res.json({
      message: "Sử dụng điểm thành công",
      data: result,
    });
  } catch (error) {
    console.error("Error in spendPoints controller:", error);

    if (error.message.includes("Không đủ điểm")) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message.includes("Người dùng không tồn tại")) {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi sử dụng điểm",
    });
  }
};

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
