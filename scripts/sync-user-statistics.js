const mongoose = require("mongoose");
const User = require("../models/user.model");
const { syncUserStatistics } = require("../services/user_statistics.service");
require("dotenv").config();

// Kết nối MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/edy_db",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Hàm đồng bộ thống kê cho tất cả users
const syncAllUserStatistics = async (year = new Date().getFullYear()) => {
  try {
    console.log(`Bắt đầu đồng bộ thống kê cho năm ${year}...`);

    // Lấy tất cả users
    const users = await User.find({ status: "ACTIVE" }).select("_id");
    console.log(`Tìm thấy ${users.length} users cần đồng bộ`);

    let successCount = 0;
    let errorCount = 0;

    // Đồng bộ từng user
    for (const user of users) {
      try {
        await syncUserStatistics(user._id, year);
        successCount++;
        console.log(`✓ Đồng bộ thành công cho user ${user._id}`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Lỗi đồng bộ cho user ${user._id}:`, error.message);
      }
    }

    console.log(`\nHoàn thành đồng bộ:`);
    console.log(`- Thành công: ${successCount}`);
    console.log(`- Lỗi: ${errorCount}`);
    console.log(`- Tổng: ${users.length}`);
  } catch (error) {
    console.error("Lỗi khi đồng bộ thống kê:", error);
  }
};

// Hàm đồng bộ thống kê cho một user cụ thể
const syncUserStatisticsById = async (
  userId,
  year = new Date().getFullYear()
) => {
  try {
    console.log(`Đồng bộ thống kê cho user ${userId} năm ${year}...`);

    const statistics = await syncUserStatistics(userId, year);
    console.log("Đồng bộ thành công:", {
      userId,
      year,
      totalUploads: statistics.totalUploads,
      totalContributions: statistics.totalContributions,
      lastSyncAt: statistics.lastSyncAt,
    });
  } catch (error) {
    console.error("Lỗi khi đồng bộ thống kê cho user:", error);
  }
};

// Chạy script
const run = async () => {
  await connectDB();

  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "all") {
    const year = args[1] ? parseInt(args[1]) : new Date().getFullYear();
    await syncAllUserStatistics(year);
  } else if (command === "user") {
    const userId = args[1];
    const year = args[2] ? parseInt(args[2]) : new Date().getFullYear();

    if (!userId) {
      console.error(
        "Vui lòng cung cấp userId: node sync-user-statistics.js user <userId> [year]"
      );
      process.exit(1);
    }

    await syncUserStatisticsById(userId, year);
  } else {
    console.log("Usage:");
    console.log(
      "  Đồng bộ tất cả users: node sync-user-statistics.js all [year]"
    );
    console.log(
      "  Đồng bộ user cụ thể: node sync-user-statistics.js user <userId> [year]"
    );
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log("Đã ngắt kết nối MongoDB");
};

if (require.main === module) {
  run().catch(console.error);
}

module.exports = {
  syncAllUserStatistics,
  syncUserStatisticsById,
};
