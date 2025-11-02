const mongoose = require("mongoose");
const AdminUserStatistics = require("../models/admin_user_statistics.model");

// Script để reset collection adminuserstatistics
async function resetAdminUserStatistics() {
  try {
    console.log("Kết nối đến MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/KLTN_Edy");

    console.log("Xóa tất cả dữ liệu cũ...");
    await AdminUserStatistics.deleteMany({});

    console.log("Xóa các index cũ...");
    const collection = AdminUserStatistics.collection;

    // Lấy danh sách indexes hiện tại
    const indexes = await collection.indexes();
    console.log("Indexes hiện tại:", indexes.map(idx => idx.name));

    // Drop các index cũ
    const oldIndexes = ['date_1', 'year_1', 'date_1_unique'];
    for (const indexName of oldIndexes) {
      try {
        await collection.dropIndex(indexName);
        console.log(`Đã xóa index: ${indexName}`);
      } catch (error) {
        console.log(`Index ${indexName} không tồn tại hoặc đã bị xóa`);
      }
    }

    console.log("Tạo lại indexes mới...");
    await AdminUserStatistics.createIndexes();

    console.log("Hoàn thành! Collection đã được reset.");
    console.log("Bạn có thể chạy sync để tạo dữ liệu mới theo tháng.");

  } catch (error) {
    console.error("Lỗi:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Đã ngắt kết nối MongoDB");
  }
}

// Chạy script
resetAdminUserStatistics();