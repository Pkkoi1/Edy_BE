const DocumentStatistics = require("../models/document_statistics.model");
const Document = require("../models/document.model");
const {
  incrementViewCount: incrementViewCountStats,
  generateDocumentStatistics: generateDocumentStatisticsService,
  getDocumentStatistics: getDocumentStatisticsService,
  getMonthlyData,
  getYearlyData,
  generateAllStatistics,
  getSystemStatistics,
  getDownloadLinkStatistics,
  syncDocumentIds,
} = require("../services/document_statistics.service");

// Lấy thống kê tài liệu theo năm và tháng
exports.getDocumentStatistics = async (req, res) => {
  try {
    const { year, month } = req.query;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const monthNum = month ? parseInt(month) : null;

    const statistics = await getDocumentStatisticsService(yearNum, monthNum);

    // Format dữ liệu trả về phù hợp với giao diện
    const response = {
      stats: {
        totalDocuments: statistics ? statistics.totalDocuments : 0,
        totalViews: statistics ? statistics.totalViews : 0,
        totalDownloads: statistics ? statistics.totalDownloads : 0,
      },
      documentTypes: statistics ? statistics.documentTypes : {},
      topDocuments: statistics
        ? statistics.topDocuments.map((doc, index) => ({
            document: doc.document, // ← ObjectId của document
            title: doc.title,
            views: doc.views,
            downloads: doc.downloads,
            rating: `${doc.rating}%`,
          }))
        : [],
      approvedDocuments: statistics
        ? statistics.approvedDocuments.map((doc, index) => ({
            document: doc.document, // ← ObjectId của document
            title: doc.title,
            author: doc.author,
            subject: doc.subject,
            uploadDate: doc.uploadDate.toISOString().split("T")[0],
            approvedDate: doc.approvedDate.toISOString().split("T")[0],
            approvedBy: doc.approvedBy,
            status: doc.status,
          }))
        : [],
      monthlyData: monthNum
        ? await getMonthlyData(yearNum, monthNum)
        : await getYearlyData(yearNum),
      lastUpdated: statistics ? statistics.lastUpdated : null,
    };

    res.json(response);
  } catch (error) {
    console.error("Error getting document statistics:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy thống kê tài liệu" });
  }
};

// API để đồng bộ thống kê theo tháng/năm
exports.syncMonthStatistics = async (req, res) => {
  try {
    const { year, month } = req.body;
    const yearNum = year || new Date().getFullYear();
    const monthNum = month || new Date().getMonth() + 1;

    const statistics = await generateDocumentStatisticsService(
      yearNum,
      monthNum
    );

    res.json({
      message: "Đồng bộ thống kê thành công",
      statistics,
    });
  } catch (error) {
    console.error("Error syncing document statistics:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đồng bộ thống kê" });
  }
};

// API để tăng view count theo tháng/năm
exports.incrementViewCount = async (req, res) => {
  try {
    const statistics = await incrementViewCountStats();

    res.json({
      message: "View count incremented successfully",
      statistics,
    });
  } catch (error) {
    console.error("Error incrementing view count:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi tăng view count" });
  }
};

// API để đồng bộ thống kê cho toàn bộ hệ thống
exports.syncAllStatistics = async (req, res) => {
  try {
    await generateAllStatistics();

    // Đồng bộ document IDs sau khi đồng bộ thống kê
    const syncResult = await syncDocumentIds();

    res.json({
      message: `Đồng bộ thống kê cho toàn bộ hệ thống thành công. ${syncResult.message}`,
    });
  } catch (error) {
    console.error("Error syncing all statistics:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi đồng bộ thống kê toàn hệ thống" });
  }
};

// API để lấy thống kê tổng quan toàn hệ thống
exports.getSystemStatistics = async (req, res) => {
  try {
    const statistics = await getSystemStatistics();

    res.json({
      message: "Lấy thống kê hệ thống thành công",
      data: statistics,
    });
  } catch (error) {
    console.error("Error getting system statistics:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy thống kê hệ thống" });
  }
};

// API để lấy thống kê download links
exports.getDownloadLinkStatistics = async (req, res) => {
  try {
    const { year, month } = req.query;
    const statistics = await getDownloadLinkStatistics(year, month);

    res.json({
      message: "Lấy thống kê download links thành công",
      data: statistics,
    });
  } catch (error) {
    console.error("Error getting download link statistics:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy thống kê download links" });
  }
};
