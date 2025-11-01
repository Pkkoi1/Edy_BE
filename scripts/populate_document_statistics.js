const DocumentStatistics = require("../models/document_statistics.model");

// Script để tạo dữ liệu mẫu cho thống kê tài liệu
const populateDocumentStatistics = async () => {
  try {
    console.log("Bắt đầu tạo dữ liệu mẫu thống kê tài liệu...");

    // Tạo dữ liệu cho năm 2024 và 2025
    for (const year of [2024, 2025]) {
      // Tạo thống kê tháng
      for (let month = 1; month <= 12; month++) {
        const daysInMonth = new Date(year, month, 0).getDate();

        // Thống kê tổng tháng
        await DocumentStatistics.findOneAndUpdate(
          { year, month, day: { $exists: false } },
          {
            totalDocuments: Math.floor(Math.random() * 50) + 100,
            totalViews: Math.floor(Math.random() * 50000) + 10000,
            totalDownloads: Math.floor(Math.random() * 5000) + 1000,
            documentTypes: {
              RESEARCH_REPORT: Math.floor(Math.random() * 20) + 10,
              STUDY_GUIDE: Math.floor(Math.random() * 15) + 5,
              TEXTBOOK: Math.floor(Math.random() * 10) + 5,
              ESSAY: Math.floor(Math.random() * 8) + 3,
              OTHER: Math.floor(Math.random() * 5) + 1,
            },
            topDocuments: Array.from({ length: 5 }, (_, i) => ({
              document: `doc_${year}_${month}_${i + 1}`,
              title: `Tài liệu ứng hộp Kinh tế chính trị Mác Lênin ${i + 1}`,
              views: Math.floor(Math.random() * 200) + 100,
              downloads: Math.floor(Math.random() * 50) + 10,
              rating: Math.floor(Math.random() * 20) + 80,
            })),
            approvedDocuments: Array.from({ length: 5 }, (_, i) => ({
              document: `approved_doc_${year}_${month}_${i + 1}`,
              title: `Tài liệu đã duyệt ${i + 1}`,
              author: `Tác giả ${i + 1}`,
              subject: `Môn học ${i + 1}`,
              uploadDate: new Date(
                year,
                month - 1,
                Math.floor(Math.random() * daysInMonth) + 1
              ),
              approvedDate: new Date(
                year,
                month - 1,
                Math.floor(Math.random() * daysInMonth) + 2
              ),
              approvedBy: Math.random() > 0.5 ? "AI" : "Admin",
              status: "Đã duyệt",
            })),
            lastUpdated: new Date(),
          },
          { upsert: true, new: true }
        );

        // Tạo thống kê hàng ngày
        for (let day = 1; day <= daysInMonth; day++) {
          await DocumentStatistics.findOneAndUpdate(
            { year, month, day },
            {
              dailyViews: Math.floor(Math.random() * 100) + 20,
              dailyDownloads: Math.floor(Math.random() * 50) + 5,
              lastUpdated: new Date(),
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    console.log("Hoàn thành tạo dữ liệu mẫu thống kê tài liệu!");
  } catch (error) {
    console.error("Lỗi khi tạo dữ liệu mẫu:", error);
  }
};

module.exports = populateDocumentStatistics;

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");

  mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/edy")
    .then(async () => {
      await populateDocumentStatistics();
      process.exit(0);
    })
    .catch((error) => {
      console.error("Lỗi kết nối database:", error);
      process.exit(1);
    });
}
