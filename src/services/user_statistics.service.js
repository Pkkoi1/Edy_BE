const UserStatistics = require("../models/user_statistics.model");
const User = require("../models/user.model");
const Document = require("../models/document.model");
const Comment = require("../models/comment.model");
const PointTransaction = require("../models/point_transaction.model");
const ViolationLog = require("../models/violation_log.model");
const DownloadLink = require("../models/download_link.model");
const mongoose = require("mongoose");

const syncUserStatistics = async (userId, year = new Date().getFullYear()) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    // Tạo khoảng thời gian cho năm được chỉ định
    const startDate = new Date(year, 0, 1); // 1/1/year
    const endDate = new Date(year + 1, 0, 1); // 1/1/(year+1)

    // Lấy thông tin user để có doc_count và rank_point
    const user = await User.findById(userObjectId);

    // 1. Lấy thông tin tổng quan
    // Tài liệu: tính tổng tài liệu của người dùng (từ user.doc_count)
    const totalUploads = user ? user.doc_count : 0;

    // Tổng điểm đóng góp: điểm hạng (từ user.rank_point)
    const totalContributions = user ? user.rank_point : 0;

    // Tổng số bình luận: check Comment có user của người dùng không
    const totalComments = await Comment.countDocuments({
      user: userObjectId,
      is_deleted: false,
    });

    // Tổng lượt tải: kiểm tra ở downloadlink
    const totalDownloads = await DownloadLink.countDocuments({
      user: userObjectId,
      status: "SUCCESS",
    });

    // 2. Thống kê theo loại tài liệu
    const documentTypesResult = await Document.aggregate([
      {
        $match: {
          user: userObjectId,
          createdAt: { $gte: startDate, $lt: endDate },
          is_deleted: false,
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$doc_type", "OTHER"] },
          count: { $sum: 1 },
        },
      },
    ]);

    const documentTypes = {
      RESEARCH_REPORT: 0,
      VIDEO: 0,
      STUDY_GUIDE: 0,
      TEXTBOOK: 0,
      ESSAY: 0,
      SOLUTION_SET: 0,
      THESIS: 0,
      LECTURE: 0,
      OTHER: 0,
    };

    documentTypesResult.forEach((item) => {
      if (documentTypes.hasOwnProperty(item._id)) {
        documentTypes[item._id] = item.count;
      }
    });

    // 3. Lịch sử điểm từ point_transaction theo tháng
    const pointHistoryResult = await PointTransaction.aggregate([
      {
        $match: {
          user: userObjectId,
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            type: "$type",
          },
          total: { $sum: "$point" },
        },
      },
    ]);

    const pointHistory = {};
    for (let month = 1; month <= 12; month++) {
      pointHistory[month] = { earned: 0, spent: 0 };
    }

    pointHistoryResult.forEach((item) => {
      const month = item._id.month;
      if (item._id.type === "EARN") {
        pointHistory[month].earned = item.total;
      } else if (item._id.type === "SPEND") {
        pointHistory[month].spent = item.total;
      }
    });

    // 4. Top 3 tài liệu tiêu biểu (theo view + download + rating)
    const topDocumentsResult = await Document.find({
      user: userObjectId,
      createdAt: { $gte: startDate, $lt: endDate },
      is_deleted: false,
    }).select("title view download_count like dislike");

    // Tính điểm cho mỗi tài liệu và sắp xếp
    const topDocuments = topDocumentsResult
      .map((doc) => {
        const totalVotes = doc.like + doc.dislike;
        const rating =
          totalVotes > 0 ? Math.round((doc.like / totalVotes) * 100) : 0;

        // Tính điểm tổng hợp: lượt xem (30%) + lượt tải (40%) + đánh giá (30%)
        const score = doc.view * 0.3 + doc.download_count * 0.4 + rating * 0.3;

        return {
          document: doc._id,
          title: doc.title,
          views: doc.view,
          downloads: doc.download_count,
          rating: rating,
          score: score,
        };
      })
      .sort((a, b) => b.score - a.score) // Sắp xếp giảm dần theo điểm
      .slice(0, 3); // Lấy top 3

    // 5. Báo cáo/cảnh cáo theo tháng từ violation_log
    const monthlyViolationsResult = await ViolationLog.aggregate([
      {
        $match: {
          user: userObjectId,
          createdAt: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $unwind: "$type", // Mở rộng mảng type
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            type: "$type",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const monthlyViolations = {};
    for (let month = 1; month <= 12; month++) {
      monthlyViolations[month] = {
        SPAM_OR_MISLEADING: 0,
        DUPLICATE: 0,
        COPYRIGHT: 0,
        INCORRECT_CATEGORY: 0,
        PERSONAL_INFORMATION: 0,
        LOW_QUALITY: 0,
        INAPPROPRIATE: 0,
        OTHER: 0,
      };
    }

    monthlyViolationsResult.forEach((item) => {
      const month = item._id.month;
      const type = item._id.type;
      if (
        monthlyViolations[month] &&
        monthlyViolations[month].hasOwnProperty(type)
      ) {
        monthlyViolations[month][type] = item.count;
      }
    });

    // Cập nhật hoặc tạo mới thống kê
    const statistics = await UserStatistics.findOneAndUpdate(
      { user: userObjectId, year: year },
      {
        totalUploads,
        totalContributions,
        totalComments,
        totalDownloads,
        documentTypes,
        pointHistory,
        topDocuments,
        monthlyViolations,
        lastSyncAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      }
    );

    return statistics;
  } catch (error) {
    console.error("Error syncing user statistics:", error);
    throw error;
  }
};

const getUserStatistics = async (userId, year = new Date().getFullYear()) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    let statistics = await UserStatistics.findOne({
      user: userObjectId,
      year: year,
    });

    // Nếu chưa có thống kê hoặc quá cũ (hơn 1 ngày), đồng bộ lại
    if (
      !statistics ||
      new Date() - new Date(statistics.lastSyncAt) > 24 * 60 * 60 * 1000
    ) {
      statistics = await syncUserStatistics(userId, year);
    }

    return statistics;
  } catch (error) {
    console.error("Error getting user statistics:", error);
    throw error;
  }
};

const getUserStatisticsByYear = async (userId, year) => {
  return await getUserStatistics(userId, year);
};

module.exports = {
  syncUserStatistics,
  getUserStatistics,
  getUserStatisticsByYear,
};
