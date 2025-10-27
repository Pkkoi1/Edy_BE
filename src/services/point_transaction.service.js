const PointTransaction = require("../models/point_transaction.model");
const User = require("../models/user.model");

const createPointTransaction = async (
  userId,
  type,
  amount,
  reason,
  pointType
) => {
  const transaction = new PointTransaction({
    user: userId,
    type,
    point: amount,
    reason,
    pointType,
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
    await createPointTransaction(userId, "SPEND", amount, reason, "USAGE");

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

const earnPoints = async (userId, amount, reason) => {
  try {
    // Kiểm tra user có tồn tại không
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Cộng điểm cho cả point và rank_point
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { point: amount, rank_point: amount } },
      { new: true }
    );

    // Tạo transaction record
    await createPointTransaction(userId, "EARN", amount, reason, "BOTH");

    return {
      success: true,
      user: {
        _id: updatedUser._id,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        point: updatedUser.point,
        rank_point: updatedUser.rank_point,
      },
      earned_amount: amount,
      total_points: updatedUser.point,
      total_rank_points: updatedUser.rank_point,
    };
  } catch (error) {
    throw error;
  }
};

const penalizeUser = async (userId, amount, reason) => {
  try {
    // Kiểm tra user có tồn tại không
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Kiểm tra rank_point đủ để trừ không
    if (user.rank_point < amount) {
      throw new Error("Không đủ điểm hạng để thực hiện thao tác này");
    }

    // Tăng strike
    const newStrike = user.strike + 1;
    let status = user.status;

    // Xác định trạng thái dựa trên strike
    if (newStrike > 10) {
      status = "BANNED";
      // Trừ hết điểm nếu >10 strike
      await User.findByIdAndUpdate(userId, {
        point: 0,
        rank_point: 0,
        strike: newStrike,
        status,
      });
    } else if (newStrike >= 5) {
      status = "INACTIVE"; // Temporary ban
    } else if (newStrike >= 3) {
      status = "INACTIVE"; // Restrictions
    } else {
      status = "ACTIVE";
    }

    // Trừ rank_point nếu chưa bị ban vĩnh viễn
    if (newStrike <= 10) {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { rank_point: -amount }, strike: newStrike, status },
        { new: true }
      );

      // Tạo transaction record
      await createPointTransaction(
        userId,
        "SPEND",
        amount,
        reason,
        "RANKPOINT"
      );

      return {
        success: true,
        user: {
          _id: updatedUser._id,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          rank_point: updatedUser.rank_point,
          strike: updatedUser.strike,
          status: updatedUser.status,
        },
        penalized_amount: amount,
        remaining_rank_points: updatedUser.rank_point,
        new_strike: newStrike,
      };
    } else {
      // Đã xử lý ở trên
      const updatedUser = await User.findById(userId);
      return {
        success: true,
        user: {
          _id: updatedUser._id,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          rank_point: updatedUser.rank_point,
          strike: updatedUser.strike,
          status: updatedUser.status,
        },
        penalized_amount: amount,
        remaining_rank_points: updatedUser.rank_point,
        new_strike: newStrike,
      };
    }
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
  earnPoints,
  penalizeUser,
  getPointHistoryByUserId,
};
