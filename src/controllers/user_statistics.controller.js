const {
  getUserStatistics,
  syncUserStatistics,
  getUserStatisticsByYear,
} = require("../services/user_statistics.service");

exports.getMyStatistics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const year = req.query.year
      ? parseInt(req.query.year)
      : new Date().getFullYear();

    const statistics = await getUserStatistics(userId, year);

    if (!statistics) {
      return res.status(404).json({ message: "Không tìm thấy thống kê" });
    }

    // Format dữ liệu trả về phù hợp với giao diện
    const response = {
      stats: {
        totalUploads: statistics.totalUploads,
        totalContributions: statistics.totalContributions,
        totalComments: statistics.totalComments,
        totalDownloads: statistics.totalDownloads,
      },
      documentTypes: statistics.documentTypes,
      monthlyPoints: {
        labels: [
          "T1",
          "T2",
          "T3",
          "T4",
          "T5",
          "T6",
          "T7",
          "T8",
          "T9",
          "T10",
          "T11",
          "T12",
        ],
        earned: Object.values(statistics.pointHistory).map((m) => m.earned),
        spent: Object.values(statistics.pointHistory).map((m) => m.spent),
      },
      topDocuments: statistics.topDocuments.map((doc, index) => ({
        key: doc.document.toString(),
        stt: index + 1,
        title: doc.title,
        views: doc.views,
        downloads: doc.downloads,
        rating: `${doc.rating}%`,
      })),
      monthlyReports: {
        labels: [
          "T1",
          "T2",
          "T3",
          "T4",
          "T5",
          "T6",
          "T7",
          "T8",
          "T9",
          "T10",
          "T11",
          "T12",
        ],
        datasets: [
          {
            label: "SPAM_OR_MISLEADING",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.SPAM_OR_MISLEADING
            ),
          },
          {
            label: "DUPLICATE",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.DUPLICATE
            ),
          },
          {
            label: "COPYRIGHT",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.COPYRIGHT
            ),
          },
          {
            label: "INCORRECT_CATEGORY",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.INCORRECT_CATEGORY
            ),
          },
          {
            label: "PERSONAL_INFORMATION",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.PERSONAL_INFORMATION
            ),
          },
          {
            label: "LOW_QUALITY",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.LOW_QUALITY
            ),
          },
          {
            label: "INAPPROPRIATE",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.INAPPROPRIATE
            ),
          },
          {
            label: "OTHER",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.OTHER
            ),
          },
        ],
      },
      lastSyncAt: statistics.lastSyncAt,
    };

    res.json(response);
  } catch (error) {
    console.error("Error getting user statistics:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy thống kê cá nhân" });
  }
};

exports.syncMyStatistics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const year = req.query.year
      ? parseInt(req.query.year)
      : new Date().getFullYear();

    const statistics = await syncUserStatistics(userId, year);

    res.json({
      message: "Đồng bộ thống kê thành công",
      lastSyncAt: statistics.lastSyncAt,
    });
  } catch (error) {
    console.error("Error syncing user statistics:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đồng bộ thống kê" });
  }
};

exports.getStatisticsByYear = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { year } = req.params;

    if (!year || isNaN(year)) {
      return res.status(400).json({ message: "Năm không hợp lệ" });
    }

    const yearNum = parseInt(year);
    const statistics = await getUserStatisticsByYear(userId, yearNum);

    if (!statistics) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy thống kê cho năm này" });
    }

    // Format dữ liệu tương tự như getMyStatistics
    const response = {
      stats: {
        totalUploads: statistics.totalUploads,
        totalContributions: statistics.totalContributions,
        totalComments: statistics.totalComments,
        totalDownloads: statistics.totalDownloads,
      },
      documentTypes: statistics.documentTypes,
      monthlyPoints: {
        labels: [
          "T1",
          "T2",
          "T3",
          "T4",
          "T5",
          "T6",
          "T7",
          "T8",
          "T9",
          "T10",
          "T11",
          "T12",
        ],
        earned: Object.values(statistics.pointHistory).map((m) => m.earned),
        spent: Object.values(statistics.pointHistory).map((m) => m.spent),
      },
      topDocuments: statistics.topDocuments.map((doc, index) => ({
        key: doc.document.toString(),
        stt: index + 1,
        title: doc.title,
        views: doc.views,
        downloads: doc.downloads,
        rating: `${doc.rating}%`,
      })),
      monthlyReports: {
        labels: [
          "T1",
          "T2",
          "T3",
          "T4",
          "T5",
          "T6",
          "T7",
          "T8",
          "T9",
          "T10",
          "T11",
          "T12",
        ],
        datasets: [
          {
            label: "SPAM_OR_MISLEADING",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.SPAM_OR_MISLEADING
            ),
          },
          {
            label: "DUPLICATE",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.DUPLICATE
            ),
          },
          {
            label: "COPYRIGHT",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.COPYRIGHT
            ),
          },
          {
            label: "INCORRECT_CATEGORY",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.INCORRECT_CATEGORY
            ),
          },
          {
            label: "PERSONAL_INFORMATION",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.PERSONAL_INFORMATION
            ),
          },
          {
            label: "LOW_QUALITY",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.LOW_QUALITY
            ),
          },
          {
            label: "INAPPROPRIATE",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.INAPPROPRIATE
            ),
          },
          {
            label: "OTHER",
            data: Object.values(statistics.monthlyViolations).map(
              (m) => m.OTHER
            ),
          },
        ],
      },
      lastSyncAt: statistics.lastSyncAt,
    };

    res.json(response);
  } catch (error) {
    console.error("Error getting statistics by year:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy thống kê theo năm" });
  }
};
