const DocumentStatistics = require("../models/document_statistics.model");
const Document = require("../models/document.model");
const Reaction = require("../models/reaction.model");
const ApprovalRequest = require("../models/approval_request.model");
const DownloadLink = require("../models/download_link.model");

// Hàm tăng view count cho thống kê theo tháng/năm
const incrementViewCount = async () => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Tăng totalViews cho tháng hiện tại
    const statistics = await DocumentStatistics.findOneAndUpdate(
      {
        year,
        month,
        day: { $exists: false },
      },
      {
        $inc: { totalViews: 1 },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );

    return statistics;
  } catch (error) {
    console.error("Error incrementing view count:", error);
    throw error;
  }
};

// Hàm tạo thống kê từ database theo tháng/năm
const generateDocumentStatistics = async (year, month) => {
  const startDate = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const endDate = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);

  // Tổng quan - đếm theo last_approved_at
  const totalStats = await Document.aggregate([
    {
      $match: {
        last_approved_at: { $gte: startDate, $lt: endDate },
        is_deleted: false,
        status: "APPROVED",
      },
    },
    {
      $group: {
        _id: null,
        totalDocuments: { $sum: 1 },
      },
    },
  ]);

  // Lấy totalViews từ DocumentStatistics (không từ Document model)
  const viewStats = await DocumentStatistics.aggregate([
    {
      $match: {
        year: year,
        month: month || { $exists: true },
        day: { $exists: false },
      },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$totalViews" },
      },
    },
  ]);

  // Tính totalDownloads từ DownloadLink với status SUCCESS
  const downloadStats = await DownloadLink.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lt: endDate },
        status: "SUCCESS",
      },
    },
    {
      $group: {
        _id: null,
        totalDownloads: { $sum: 1 },
      },
    },
  ]);

  // Thống kê theo loại - dựa trên last_approved_at
  const typeStats = await Document.aggregate([
    {
      $match: {
        last_approved_at: { $gte: startDate, $lt: endDate },
        is_deleted: false,
        status: "APPROVED",
      },
    },
    {
      $group: {
        _id: "$doc_type",
        count: { $sum: 1 },
      },
    },
  ]);

  const documentTypes = {};
  typeStats.forEach((stat) => {
    documentTypes[stat._id] = stat.count;
  });

  // Top documents - dựa trên view/download count từ Document model
  const topDocs = await Document.find({
    last_approved_at: { $gte: startDate, $lt: endDate },
    is_deleted: false,
    status: "APPROVED",
  })
    .sort({ view: -1, download_count: -1 })
    .limit(5)
    .select("_id title view download_count")
    .lean();

  // Tính rating cho từng document
  const topDocuments = await Promise.all(
    topDocs.map(async (doc) => {
      const reactions = await Reaction.find({ doc: doc._id });
      const likes = reactions.filter((r) => r.type === "LIKE").length;
      const dislikes = reactions.filter((r) => r.type === "DISLIKE").length;
      const total = likes + dislikes;
      const rating = total === 0 ? 0 : Math.round((likes / total) * 100);

      return {
        document: doc._id,
        title: doc.title,
        views: doc.view,
        downloads: doc.download_count,
        rating: rating,
      };
    })
  );

  // Approved documents
  const approvedDocs = await Document.find({
    status: "APPROVED",
    last_approved_at: { $gte: startDate, $lt: endDate },
    is_deleted: false,
  })
    .populate("user", "first_name last_name")
    .populate("subject", "name")
    .sort({ last_approved_at: -1 })
    .limit(10)
    .lean();

  const approvedDocuments = await Promise.all(
    approvedDocs.map(async (doc) => {
      // Tìm approval request để lấy người duyệt
      const approvalRequest = await ApprovalRequest.findOne({
        doc: doc._id,
        status: "APPROVED",
      }).populate("reviewed_by", "first_name last_name");

      let approvedBy = "AI"; // Default
      if (approvalRequest && approvalRequest.reviewed_by) {
        approvedBy = `${approvalRequest.reviewed_by.first_name} ${approvalRequest.reviewed_by.last_name}`;
      }

      return {
        document: doc._id,
        title: doc.title,
        author: doc.user
          ? `${doc.user.first_name} ${doc.user.last_name}`
          : "Unknown",
        subject: doc.subject ? doc.subject.name : "Unknown",
        uploadDate: doc.createdAt,
        approvedDate: doc.last_approved_at,
        approvedBy: approvedBy,
        status: "Đã duyệt",
      };
    })
  );

  // Lưu vào database
  const statistics = await DocumentStatistics.findOneAndUpdate(
    {
      year,
      month: month || 0,
      day: { $exists: false },
    },
    {
      totalDocuments: totalStats[0]?.totalDocuments || 0,
      totalViews: viewStats[0]?.totalViews || 0,
      totalDownloads: downloadStats[0]?.totalDownloads || 0,
      documentTypes,
      topDocuments,
      approvedDocuments,
      lastUpdated: new Date(),
    },
    { upsert: true, new: true }
  );

  return statistics;
};

// Hàm lấy thống kê theo năm và tháng
const getDocumentStatistics = async (year, month) => {
  const yearNum = year ? parseInt(year) : new Date().getFullYear();
  const monthNum = month ? parseInt(month) : null;

  let statistics;
  if (monthNum) {
    // Lấy thống kê theo tháng
    statistics = await DocumentStatistics.findOne({
      year: yearNum,
      month: monthNum,
      day: { $exists: false }, // Thống kê tháng
    });
  } else {
    // Tính tổng thống kê cho cả năm từ tất cả tháng
    const yearlyStats = await DocumentStatistics.aggregate([
      {
        $match: {
          year: yearNum,
          month: { $gte: 1, $lte: 12 },
          day: { $exists: false },
        },
      },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: "$totalDocuments" },
          totalViews: { $sum: "$totalViews" },
          totalDownloads: { $sum: "$totalDownloads" },
          documentTypes: { $mergeObjects: "$documentTypes" },
          topDocuments: { $push: "$topDocuments" },
          approvedDocuments: { $push: "$approvedDocuments" },
        },
      },
    ]);

    if (yearlyStats.length > 0) {
      const stats = yearlyStats[0];

      // Merge documentTypes
      const mergedTypes = {};
      Object.keys(stats.documentTypes || {}).forEach((key) => {
        if (typeof stats.documentTypes[key] === "object") {
          // Nếu là object (có thể từ mergeObjects), lấy giá trị
          mergedTypes[key] = Object.values(stats.documentTypes[key]).reduce(
            (sum, val) => sum + (val || 0),
            0
          );
        } else {
          mergedTypes[key] = stats.documentTypes[key] || 0;
        }
      });

      // Flatten và merge topDocuments
      const allTopDocs = (stats.topDocuments || []).flat().filter((doc) => doc);
      const uniqueTopDocs = [];
      const seen = new Set();

      allTopDocs.forEach((doc) => {
        if (!seen.has(doc.document.toString())) {
          seen.add(doc.document.toString());
          uniqueTopDocs.push(doc);
        }
      });

      // Sort theo views + downloads và lấy top 5
      uniqueTopDocs.sort(
        (a, b) => b.views + b.downloads - (a.views + a.downloads)
      );
      const topDocuments = uniqueTopDocs.slice(0, 5);

      // Flatten và merge approvedDocuments
      const allApprovedDocs = (stats.approvedDocuments || [])
        .flat()
        .filter((doc) => doc);
      const uniqueApprovedDocs = [];
      const seenApproved = new Set();

      allApprovedDocs.forEach((doc) => {
        if (!seenApproved.has(doc.document.toString())) {
          seenApproved.add(doc.document.toString());
          uniqueApprovedDocs.push(doc);
        }
      });

      // Sort theo approvedDate và lấy top 10
      uniqueApprovedDocs.sort(
        (a, b) => new Date(b.approvedDate) - new Date(a.approvedDate)
      );
      const approvedDocuments = uniqueApprovedDocs.slice(0, 10);

      statistics = {
        year: yearNum,
        month: 0,
        totalDocuments: stats.totalDocuments || 0,
        totalViews: stats.totalViews || 0,
        totalDownloads: stats.totalDownloads || 0,
        documentTypes: mergedTypes,
        topDocuments,
        approvedDocuments,
        lastUpdated: new Date(),
      };
    }
  }

  // Không tự động generate, trả về dữ liệu có sẵn hoặc null
  return statistics;
};

// Hàm lấy dữ liệu hàng ngày trong tháng
const getMonthlyData = async (year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const data = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStart = new Date(year, month - 1, day);
    const dayEnd = new Date(year, month - 1, day + 1);

    // Lấy views từ DocumentStatistics (nếu có)
    const stat = await DocumentStatistics.findOne({
      year,
      month,
      day,
    });

    // Tính downloads từ DownloadLink
    const downloadResult = await DownloadLink.aggregate([
      {
        $match: {
          createdAt: { $gte: dayStart, $lt: dayEnd },
          status: "SUCCESS",
        },
      },
      {
        $group: {
          _id: null,
          downloads: { $sum: 1 },
        },
      },
    ]);

    data.push({
      day: `${month.toString().padStart(2, "0")}/${day
        .toString()
        .padStart(2, "0")}`,
      views: stat ? stat.dailyViews : 0,
      downloads: downloadResult[0]?.downloads || 0,
    });
  }
  return data;
};

// Hàm lấy dữ liệu theo tháng trong năm
const getYearlyData = async (year) => {
  const data = [];
  for (let month = 1; month <= 12; month++) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // Lấy views từ DocumentStatistics
    const stat = await DocumentStatistics.findOne({
      year,
      month,
      day: { $exists: false },
    });

    // Tính downloads từ DownloadLink
    const downloadResult = await DownloadLink.aggregate([
      {
        $match: {
          createdAt: { $gte: monthStart, $lt: monthEnd },
          status: "SUCCESS",
        },
      },
      {
        $group: {
          _id: null,
          downloads: { $sum: 1 },
        },
      },
    ]);

    data.push({
      month: `T${month}`,
      views: stat ? stat.totalViews : 0,
      downloads: downloadResult[0]?.downloads || 0,
    });
  }
  return data;
};

// Hàm tạo thống kê cho toàn bộ hệ thống
const generateAllStatistics = async () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Tạo thống kê cho tất cả các tháng trong năm hiện tại
  for (let month = 1; month <= currentMonth; month++) {
    try {
      await generateDocumentStatistics(currentYear, month);
      console.log(`Generated statistics for ${currentYear}-${month}`);
    } catch (error) {
      console.error(
        `Error generating statistics for ${currentYear}-${month}:`,
        error
      );
    }
  }

  // Tạo thống kê tổng quan năm
  try {
    await generateDocumentStatistics(currentYear, null);
    console.log(`Generated yearly statistics for ${currentYear}`);
  } catch (error) {
    console.error(
      `Error generating yearly statistics for ${currentYear}:`,
      error
    );
  }
};

// Hàm lấy thống kê tổng quan toàn hệ thống
const getSystemStatistics = async () => {
  const currentYear = new Date().getFullYear();

  // Lấy thống kê tổng quan năm
  const yearlyStats = await DocumentStatistics.findOne({
    year: currentYear,
    month: 0,
    day: { $exists: false },
  });

  // Lấy thống kê tất cả các tháng
  const monthlyStats = await DocumentStatistics.find({
    year: currentYear,
    month: { $gte: 1, $lte: 12 },
    day: { $exists: false },
  }).sort({ month: 1 });

  // Tính tổng lượt xem từ DocumentStatistics
  const totalViews = monthlyStats.reduce(
    (sum, stat) => sum + (stat.totalViews || 0),
    0
  );

  // Tính tổng lượt tải từ DownloadLink với status SUCCESS trong năm hiện tại
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear + 1, 0, 1);
  const downloadResult = await DownloadLink.aggregate([
    {
      $match: {
        createdAt: { $gte: yearStart, $lt: yearEnd },
        status: "SUCCESS",
      },
    },
    {
      $group: {
        _id: null,
        totalDownloads: { $sum: 1 },
      },
    },
  ]);

  const totalDownloads = downloadResult[0]?.totalDownloads || 0;

  // Đếm tổng số tài liệu đã duyệt
  const totalDocuments = await Document.countDocuments({
    status: "APPROVED",
    is_deleted: false,
  });

  return {
    totalDocuments,
    totalViews,
    totalDownloads,
    yearlyStats,
    monthlyStats,
  };
};

// Hàm thống kê download links theo năm/tháng
const getDownloadLinkStatistics = async (year, month) => {
  const yearNum = year ? parseInt(year) : new Date().getFullYear();
  const monthNum = month ? parseInt(month) : null;

  const startDate = monthNum
    ? new Date(yearNum, monthNum - 1, 1)
    : new Date(yearNum, 0, 1);
  const endDate = monthNum
    ? new Date(yearNum, monthNum, 1)
    : new Date(yearNum + 1, 0, 1);

  // Thống kê tổng quan download links
  const totalStats = await DownloadLink.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalLinks: { $sum: 1 },
        successfulDownloads: {
          $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
        },
        pendingLinks: {
          $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
        },
        expiredLinks: {
          $sum: { $cond: [{ $eq: ["$status", "EXPIRED"] }, 1, 0] },
        },
        totalPointsSpent: {
          $sum: { $cond: [{ $eq: ["$type", "POINT"] }, "$cost", 0] },
        },
      },
    },
  ]);

  // Thống kê theo loại (FREE/POINT)
  const typeStats = await DownloadLink.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
        },
        pointsSpent: {
          $sum: { $cond: [{ $eq: ["$type", "POINT"] }, "$cost", 0] },
        },
      },
    },
  ]);

  // Thống kê theo tháng trong năm (nếu không chỉ định tháng)
  let monthlyData = [];
  if (!monthNum) {
    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(yearNum, m - 1, 1);
      const monthEnd = new Date(yearNum, m, 1);

      const monthStats = await DownloadLink.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart, $lt: monthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalLinks: { $sum: 1 },
            successfulDownloads: {
              $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
            },
            pointsSpent: {
              $sum: { $cond: [{ $eq: ["$type", "POINT"] }, "$cost", 0] },
            },
          },
        },
      ]);

      monthlyData.push({
        month: `T${m}`,
        totalLinks: monthStats[0]?.totalLinks || 0,
        successfulDownloads: monthStats[0]?.successfulDownloads || 0,
        pointsSpent: monthStats[0]?.pointsSpent || 0,
      });
    }
  }

  // Top documents được tải nhiều nhất
  const topDownloadedDocs = await DownloadLink.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lt: endDate },
        status: "SUCCESS",
      },
    },
    {
      $group: {
        _id: "$doc",
        downloadCount: { $sum: 1 },
        pointsSpent: {
          $sum: { $cond: [{ $eq: ["$type", "POINT"] }, "$cost", 0] },
        },
      },
    },
    {
      $sort: { downloadCount: -1 },
    },
    {
      $limit: 10,
    },
    {
      $lookup: {
        from: "documents",
        localField: "_id",
        foreignField: "_id",
        as: "document",
      },
    },
    {
      $unwind: "$document",
    },
    {
      $project: {
        _id: 0,
        documentId: "$_id",
        title: "$document.title",
        downloadCount: 1,
        pointsSpent: 1,
      },
    },
  ]);

  const stats = totalStats[0] || {
    totalLinks: 0,
    successfulDownloads: 0,
    pendingLinks: 0,
    expiredLinks: 0,
    totalPointsSpent: 0,
  };

  const typeBreakdown = {};
  typeStats.forEach((stat) => {
    typeBreakdown[stat._id] = {
      total: stat.total,
      successful: stat.successful,
      pointsSpent: stat.pointsSpent,
    };
  });

  return {
    period: monthNum ? `${yearNum}-${monthNum}` : yearNum.toString(),
    summary: {
      totalLinks: stats.totalLinks,
      successfulDownloads: stats.successfulDownloads,
      pendingLinks: stats.pendingLinks,
      expiredLinks: stats.expiredLinks,
      totalPointsSpent: stats.totalPointsSpent,
      successRate:
        stats.totalLinks > 0
          ? Math.round((stats.successfulDownloads / stats.totalLinks) * 100)
          : 0,
    },
    typeBreakdown,
    monthlyData: monthNum ? null : monthlyData,
    topDownloadedDocuments: topDownloadedDocs,
  };
};

// Hàm cập nhật thống kê khi tài liệu được duyệt
const updateDocumentApproved = async (documentId) => {
  try {
    const document = await Document.findById(documentId);
    if (!document || !document.last_approved_at) return;

    const approvedDate = new Date(document.last_approved_at);
    const year = approvedDate.getFullYear();
    const month = approvedDate.getMonth() + 1;

    // Tăng totalDocuments cho tháng đó
    await DocumentStatistics.findOneAndUpdate(
      {
        year,
        month,
        day: { $exists: false },
      },
      {
        $inc: { totalDocuments: 1 },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );

    // Cập nhật documentTypes nếu có doc_type
    if (document.doc_type) {
      await DocumentStatistics.findOneAndUpdate(
        {
          year,
          month,
          day: { $exists: false },
        },
        {
          $inc: { [`documentTypes.${document.doc_type}`]: 1 },
          $set: { lastUpdated: new Date() },
        },
        { upsert: true, new: true }
      );
    }
  } catch (error) {
    console.error("Error updating document approved statistics:", error);
  }
};

// Hàm cập nhật thống kê khi lượt xem tăng
const updateViewCount = async () => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Tăng totalViews cho tháng hiện tại
    await DocumentStatistics.findOneAndUpdate(
      {
        year,
        month,
        day: { $exists: false },
      },
      {
        $inc: { totalViews: 1 },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Error updating view count statistics:", error);
  }
};

// Hàm cập nhật thống kê khi download link thành công
const updateDownloadCount = async (downloadLinkId) => {
  try {
    const downloadLink = await DownloadLink.findById(downloadLinkId);
    if (!downloadLink || downloadLink.status !== "SUCCESS") return;

    const createdDate = new Date(downloadLink.createdAt);
    const year = createdDate.getFullYear();
    const month = createdDate.getMonth() + 1;

    // Tăng totalDownloads cho tháng đó
    await DocumentStatistics.findOneAndUpdate(
      {
        year,
        month,
        day: { $exists: false },
      },
      {
        $inc: { totalDownloads: 1 },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Error updating download count statistics:", error);
  }
};

// Hàm đồng bộ lại các document id trong thống kê
const syncDocumentIds = async (year, month) => {
  try {
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const monthNum = month ? parseInt(month) : null;

    // Tìm tất cả thống kê cần đồng bộ
    let query = { year: yearNum, day: { $exists: false } };
    if (monthNum) {
      query.month = monthNum;
    } else {
      query.month = { $gte: 1, $lte: 12 };
    }

    const statistics = await DocumentStatistics.find(query);

    for (const stat of statistics) {
      let needsUpdate = false;

      // Đồng bộ topDocuments
      if (stat.topDocuments && stat.topDocuments.length > 0) {
        const updatedTopDocuments = [];
        for (const doc of stat.topDocuments) {
          if (doc.document) {
            // Đảm bảo document id là ObjectId
            const docId =
              typeof doc.document === "string"
                ? mongoose.Types.ObjectId.isValid(doc.document)
                  ? new mongoose.Types.ObjectId(doc.document)
                  : null
                : doc.document;

            if (docId) {
              updatedTopDocuments.push({
                ...doc,
                document: docId,
              });
            }
          }
        }
        if (updatedTopDocuments.length !== stat.topDocuments.length) {
          stat.topDocuments = updatedTopDocuments;
          needsUpdate = true;
        }
      }

      // Đồng bộ approvedDocuments
      if (stat.approvedDocuments && stat.approvedDocuments.length > 0) {
        const updatedApprovedDocuments = [];
        for (const doc of stat.approvedDocuments) {
          if (doc.document) {
            // Đảm bảo document id là ObjectId
            const docId =
              typeof doc.document === "string"
                ? mongoose.Types.ObjectId.isValid(doc.document)
                  ? new mongoose.Types.ObjectId(doc.document)
                  : null
                : doc.document;

            if (docId) {
              updatedApprovedDocuments.push({
                ...doc,
                document: docId,
              });
            }
          }
        }
        if (updatedApprovedDocuments.length !== stat.approvedDocuments.length) {
          stat.approvedDocuments = updatedApprovedDocuments;
          needsUpdate = true;
        }
      }

      // Lưu lại nếu có thay đổi
      if (needsUpdate) {
        stat.lastUpdated = new Date();
        await stat.save();
        console.log(
          `Synced document IDs for statistics ${stat.year}-${stat.month}`
        );
      }
    }

    return {
      message: `Đã đồng bộ ID cho ${statistics.length} bản ghi thống kê`,
    };
  } catch (error) {
    console.error("Error syncing document IDs:", error);
    throw error;
  }
};

module.exports = {
  incrementViewCount,
  generateDocumentStatistics,
  getDocumentStatistics,
  getMonthlyData,
  getYearlyData,
  generateAllStatistics,
  getSystemStatistics,
  getDownloadLinkStatistics,
  updateDocumentApproved,
  updateViewCount,
  updateDownloadCount,
  syncDocumentIds,
};
