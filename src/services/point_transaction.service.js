const PointTransaction = require("../models/point_transaction.model");

const createPointTransaction = async (userId, type, amount, reason) => {
  const transaction = new PointTransaction({
    user: userId,
    type,
    point: amount,
    reason,
  });
  await transaction.save();
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
  getPointHistoryByUserId,
};
