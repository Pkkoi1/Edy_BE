const AdminUserStatistics = require("../models/admin_user_statistics.model");
const User = require("../models/user.model");
const Account = require("../models/account.model");

exports.getStatistics = async (year = null, month = null) => {
  try {
    const currentDate = new Date();

    if (year && !month) {
      // Chỉ có year, trả về thống kê cho cả năm
      return await getYearlyStatistics(year, currentDate);
    } else {
      // Có month hoặc không có gì, trả về thống kê cho tháng
      const targetYear = year || currentDate.getFullYear();
      const targetMonth = month || currentDate.getMonth() + 1;
      return await getMonthlyStatistics(targetYear, targetMonth, currentDate);
    }
  } catch (error) {
    throw new Error("Lỗi khi lấy thống kê: " + error.message);
  }
};

async function getMonthlyStatistics(year, month, currentDate) {
  // Tìm thống kê cho tháng được chọn
  const monthStats = await AdminUserStatistics.findOne({
    year: year,
    month: month,
  });

  let totalUsers = 0;
  let activeUsers = 0;
  let inactiveUsers = 0;
  let bannedUsers = 0;
  let newUsers = 0;

  if (monthStats) {
    // Lấy dữ liệu từ database
    totalUsers = monthStats.totalUsers;
    activeUsers = monthStats.activeUsers;
    inactiveUsers = monthStats.inactiveUsers;
    bannedUsers = monthStats.bannedUsers;
    newUsers = monthStats.newUsers;
  } else {
    // Nếu chưa có, tính real-time từ User model
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    totalUsers = await User.countDocuments({
      createdAt: { $lt: monthEnd },
    });
    activeUsers = await User.countDocuments({
      status: "ACTIVE",
      createdAt: { $lt: monthEnd },
    });
    inactiveUsers = await User.countDocuments({
      status: "INACTIVE",
      createdAt: { $lt: monthEnd },
    });
    bannedUsers = await User.countDocuments({
      status: "BANNED",
      createdAt: { $lt: monthEnd },
    });

    // Tính newUsers từ aggregation cho cả tháng
    const newUsersAgg = await User.aggregate([
      {
        $lookup: {
          from: "accounts",
          localField: "_id",
          foreignField: "user",
          as: "account",
        },
      },
      {
        $unwind: {
          path: "$account",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          maxCreatedAt: {
            $max: ["$createdAt", "$account.createdAt"],
          },
        },
      },
      {
        $match: {
          maxCreatedAt: {
            $gte: monthStart,
            $lt: monthEnd,
          },
        },
      },
      {
        $count: "newUsers",
      },
    ]);
    newUsers = newUsersAgg.length > 0 ? newUsersAgg[0].newUsers : 0;
  }

  // Dữ liệu biểu đồ người dùng mới theo tháng (12 tháng gần nhất)
  const monthlyNewUsers = [];
  for (let i = 11; i >= 0; i--) {
    const chartYear = currentDate.getFullYear();
    const chartMonth = currentDate.getMonth() - i + 1;

    // Tính năm và tháng cho biểu đồ
    let targetYear = chartYear;
    let targetMonth = chartMonth;
    if (chartMonth <= 0) {
      targetYear = chartYear - 1;
      targetMonth = 12 + chartMonth;
    }

    // Tìm thống kê cho tháng đó
    const chartStats = await AdminUserStatistics.findOne({
      year: targetYear,
      month: targetMonth,
    });

    let count = 0;
    if (chartStats) {
      count = chartStats.newUsers;
    } else {
      // Tính real-time từ aggregation
      const chartMonthStart = new Date(targetYear, targetMonth - 1, 1);
      const chartMonthEnd = new Date(targetYear, targetMonth, 1);

      const aggResult = await User.aggregate([
        {
          $lookup: {
            from: "accounts",
            localField: "_id",
            foreignField: "user",
            as: "account",
          },
        },
        {
          $unwind: {
            path: "$account",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            maxCreatedAt: {
              $max: ["$createdAt", "$account.createdAt"],
            },
          },
        },
        {
          $match: {
            maxCreatedAt: {
              $gte: chartMonthStart,
              $lt: chartMonthEnd,
            },
          },
        },
        {
          $count: "count",
        },
      ]);
      count = aggResult.length > 0 ? aggResult[0].count : 0;
    }

    const monthName = `T${targetMonth}`;
    monthlyNewUsers.push({ month: monthName, newUsers: count });
  }

  return {
    year,
    month,
    totalUsers,
    activeUsers,
    inactiveUsers,
    bannedUsers,
    newUsers,
    monthlyNewUsers,
  };
}

async function getYearlyStatistics(year, currentDate) {
  // Lấy thống kê cho tất cả 12 tháng trong năm
  const monthlyStats = [];
  let totalUsers = 0;
  let activeUsers = 0;
  let inactiveUsers = 0;
  let bannedUsers = 0;
  let totalNewUsers = 0;

  for (let month = 1; month <= 12; month++) {
    // Tìm thống kê cho tháng đó
    const monthStats = await AdminUserStatistics.findOne({
      year: year,
      month: month,
    });

    let monthTotalUsers = 0;
    let monthActiveUsers = 0;
    let monthInactiveUsers = 0;
    let monthBannedUsers = 0;
    let monthNewUsers = 0;

    if (monthStats) {
      // Lấy dữ liệu từ database
      monthTotalUsers = monthStats.totalUsers;
      monthActiveUsers = monthStats.activeUsers;
      monthInactiveUsers = monthStats.inactiveUsers;
      monthBannedUsers = monthStats.bannedUsers;
      monthNewUsers = monthStats.newUsers;
    } else {
      // Tính real-time cho tháng đó
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);

      monthTotalUsers = await User.countDocuments({
        createdAt: { $lt: monthEnd },
      });
      monthActiveUsers = await User.countDocuments({
        status: "ACTIVE",
        createdAt: { $lt: monthEnd },
      });
      monthInactiveUsers = await User.countDocuments({
        status: "INACTIVE",
        createdAt: { $lt: monthEnd },
      });
      monthBannedUsers = await User.countDocuments({
        status: "BANNED",
        createdAt: { $lt: monthEnd },
      });

      const newUsersAgg = await User.aggregate([
        {
          $lookup: {
            from: "accounts",
            localField: "_id",
            foreignField: "user",
            as: "account",
          },
        },
        {
          $unwind: {
            path: "$account",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            maxCreatedAt: {
              $max: ["$createdAt", "$account.createdAt"],
            },
          },
        },
        {
          $match: {
            maxCreatedAt: {
              $gte: monthStart,
              $lt: monthEnd,
            },
          },
        },
        {
          $count: "newUsers",
        },
      ]);
      monthNewUsers = newUsersAgg.length > 0 ? newUsersAgg[0].newUsers : 0;
    }

    monthlyStats.push({
      month: `T${month}`,
      totalUsers: monthTotalUsers,
      activeUsers: monthActiveUsers,
      inactiveUsers: monthInactiveUsers,
      bannedUsers: monthBannedUsers,
      newUsers: monthNewUsers,
    });

    // Cập nhật tổng cho năm (lấy từ tháng cuối cùng có dữ liệu)
    if (month <= currentDate.getMonth() + 1 || year < currentDate.getFullYear()) {
      totalUsers = monthTotalUsers;
      activeUsers = monthActiveUsers;
      inactiveUsers = monthInactiveUsers;
      bannedUsers = monthBannedUsers;
    }
    totalNewUsers += monthNewUsers;
  }

  return {
    year,
    totalUsers,
    activeUsers,
    inactiveUsers,
    bannedUsers,
    newUsers: totalNewUsers,
    monthlyStats,
  };
}

exports.getUsersList = async (page = 1, limit = 50, search = "") => {
  try {
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    if (search) {
      query = {
        $or: [
          { first_name: { $regex: search, $options: "i" } },
          { last_name: { $regex: search, $options: "i" } },
        ],
      };
    }

    // Lấy users với populate account để có email
    const users = await User.find(query)
      .populate("organization", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Lấy thông tin account cho mỗi user
    const usersWithAccount = await Promise.all(
      users.map(async (user) => {
        const account = await Account.findOne({ user: user._id }).select(
          "email is_admin is_vip"
        );
        const fullName = `${user.first_name} ${user.last_name}`;
        let role = "Người dùng";
        if (account?.is_admin) role = "Quản trị hệ thống";
        else if (account?.is_vip) role = "VIP";

        return {
          id: user._id,
          name: fullName,
          role,
          email: account?.email || "",
          posts: user.doc_count || 0, // Giả sử doc_count là số bài
          status:
            user.status === "ACTIVE"
              ? "Hoạt động"
              : user.status === "INACTIVE"
              ? "Tạm khóa"
              : "Cấm",
          score: user.rank_point || 0,
        };
      })
    );

    const total = await User.countDocuments(query);

    return {
      users: usersWithAccount,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    throw new Error("Lỗi khi lấy danh sách người dùng: " + error.message);
  }
};

exports.syncStatistics = async (year = null, month = null) => {
  try {
    const currentDate = new Date();

    if (year && !month) {
      // Sync cho cả năm: cập nhật tất cả 12 tháng
      return await syncYearStatistics(year, currentDate);
    } else {
      // Sync cho một tháng cụ thể
      const targetYear = year || currentDate.getFullYear();
      const targetMonth = month || currentDate.getMonth() + 1;

      return await syncMonthlyStatistics(targetYear, targetMonth);
    }
  } catch (error) {
    throw new Error("Lỗi khi đồng bộ thống kê: " + error.message);
  }
};

async function syncYearStatistics(year, currentDate) {
  let syncedMonths = 0;

  // Sync tất cả 12 tháng trong năm
  for (let month = 1; month <= 12; month++) {
    // Chỉ sync các tháng đã qua hoặc tháng hiện tại
    if (year < currentDate.getFullYear() || month <= currentDate.getMonth() + 1) {
      try {
        await syncMonthlyStatistics(year, month);
        syncedMonths++;
      } catch (error) {
        console.warn(`Lỗi khi sync tháng ${month}/${year}:`, error.message);
        // Tiếp tục với tháng tiếp theo thay vì dừng lại
      }
    }
  }

  return {
    message: `Đã đồng bộ ${syncedMonths} tháng trong năm ${year}`,
    year,
    syncedMonths,
  };
}

async function syncMonthlyStatistics(year, month) {
  // Tìm thống kê cho tháng này
  let stats = await AdminUserStatistics.findOne({
    year: year,
    month: month,
  });

  if (!stats) {
    stats = new AdminUserStatistics({
      year: year,
      month: month,
    });
  }

  // Tính thống kê cho cả tháng
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  // Tổng số user tính đến cuối tháng
  stats.totalUsers = await User.countDocuments({
    createdAt: { $lt: monthEnd },
  });
  stats.activeUsers = await User.countDocuments({
    status: "ACTIVE",
    createdAt: { $lt: monthEnd },
  });
  stats.inactiveUsers = await User.countDocuments({
    status: "INACTIVE",
    createdAt: { $lt: monthEnd },
  });
  stats.bannedUsers = await User.countDocuments({
    status: "BANNED",
    createdAt: { $lt: monthEnd },
  });

  // Người dùng mới trong tháng (dựa trên max(createdAt của User và Account))
  const newUsersAgg = await User.aggregate([
    {
      $lookup: {
        from: "accounts",
        localField: "_id",
        foreignField: "user",
        as: "account",
      },
    },
    {
      $unwind: {
        path: "$account",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        maxCreatedAt: {
          $max: ["$createdAt", "$account.createdAt"],
        },
      },
    },
    {
      $match: {
        maxCreatedAt: {
          $gte: monthStart,
          $lt: monthEnd,
        },
      },
    },
    {
      $count: "newUsers",
    },
  ]);

  stats.newUsers = newUsersAgg.length > 0 ? newUsersAgg[0].newUsers : 0;

  await stats.save();

  return stats;
}
