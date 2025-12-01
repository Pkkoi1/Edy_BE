const {
  getPointHistoryByUserId,
  spendUserPoints,
  earnPoints,
  penalizeUser,
} = require("../services/point_transaction.service");
const Account = require("../models/account.model");
const { notifyVipStatusChanged } = require("../services/notification.service");
const { logUserVipStatusChanged } = require("../services/activity_log.service");

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

exports.earnPoints = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Số điểm cần cộng phải lớn hơn 0",
      });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        message: "Lý do cộng điểm là bắt buộc",
      });
    }

    const result = await earnPoints(userId, amount, reason.trim());

    // Check and update VIP status after earning points
    try {
      const account = await Account.findOne({ user_id: userId }).populate(
        "user_id"
      );
      if (account && account.user_id) {
        const user = account.user_id;
        const shouldBeVip = user.rank_point >= 500;
        const isCurrentlyVip = account.is_vip;

        if (shouldBeVip !== isCurrentlyVip) {
          account.is_vip = shouldBeVip;

          // Handle VIP benefits - only increase free download count for first time VIP
          if (shouldBeVip && !account.has_been_vip) {
            user.free_download_count += 10; // Increase by 10 for first time VIP
            account.has_been_vip = true;
            await user.save();
          }

          await account.save();

          // Send notification and log activity
          await notifyVipStatusChanged(userId, shouldBeVip);
          await logUserVipStatusChanged(userId, shouldBeVip);
        }
      }
    } catch (vipError) {
      console.error("Error updating VIP status in earnPoints:", vipError);
      // Don't fail the main operation if VIP update fails
    }

    res.json({
      message: "Cộng điểm thành công",
      data: result,
    });
  } catch (error) {
    console.error("Error in earnPoints controller:", error);

    if (error.message.includes("Người dùng không tồn tại")) {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi cộng điểm",
    });
  }
};

exports.penalizeUser = async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "userId là bắt buộc",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Số điểm cần trừ phải lớn hơn 0",
      });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        message: "Lý do phạt điểm là bắt buộc",
      });
    }

    const result = await penalizeUser(userId, amount, reason.trim());

    // Check and update VIP status after penalizing user
    try {
      const account = await Account.findOne({ user_id: userId }).populate(
        "user_id"
      );
      if (account && account.user_id) {
        const user = account.user_id;
        const shouldBeVip = user.rank_point >= 500;
        const isCurrentlyVip = account.is_vip;

        if (shouldBeVip !== isCurrentlyVip) {
          account.is_vip = shouldBeVip;

          // Handle VIP benefits - only increase free download count for first time VIP
          if (shouldBeVip && !account.has_been_vip) {
            user.free_download_count += 10; // Increase by 10 for first time VIP
            account.has_been_vip = true;
            await user.save();
          }

          await account.save();

          // Send notification and log activity
          await notifyVipStatusChanged(userId, shouldBeVip);
          await logUserVipStatusChanged(userId, shouldBeVip);
        }
      }
    } catch (vipError) {
      console.error("Error updating VIP status in penalizeUser:", vipError);
      // Don't fail the main operation if VIP update fails
    }

    res.json({
      message: "Phạt điểm thành công",
      data: result,
    });
  } catch (error) {
    console.error("Error in penalizeUser controller:", error);

    if (error.message.includes("Không đủ điểm hạng")) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message.includes("Người dùng không tồn tại")) {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi phạt điểm",
    });
  }
};
