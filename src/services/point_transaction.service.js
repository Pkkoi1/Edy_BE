const PointTransaction = require("../models/point_transaction.model");
const User = require("../models/user.model");

const createPointTransaction = async (userId, type, amount, reason) => {
  const transaction = new PointTransaction({
    user: userId,
    type,
    point: amount,
    reason,
  });
  await transaction.save();
};

const spendUserPoints = async (userId, amount, reason) => {
  try {
    // Kiểm tra user có tồn tại không
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Kiểm tra điểm đủ để trừ không
    if (user.point < amount) {
      throw new Error("Không đủ điểm để thực hiện thao tác này");
    }

    // Trừ điểm của user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { point: -amount } },
      { new: true }
    );

    // Tạo transaction record
    await createPointTransaction(userId, "SPEND", amount, reason);

    return {
      success: true,
      user: {
        _id: updatedUser._id,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        point: updatedUser.point,
      },
      spent_amount: amount,
      remaining_points: updatedUser.point,
    };
  } catch (error) {
    throw error;
  }
};

const getPointHistoryByUserId = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const transactions = await PointTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "first_name last_name")
      .lean();

    const total = await PointTransaction.countDocuments({ user: userId });
    const totalPages = Math.ceil(total / limit);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error("Error getting point history:", error);
    return { error: "Lỗi khi lấy lịch sử tích điểm" };
  }
};

module.exports = {
  createPointTransaction,
  spendUserPoints,
  getPointHistoryByUserId,
};
