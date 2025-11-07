const AdminStatistics = require("../models/admin_statistics.model");
const Document = require("../models/document.model");
const User = require("../models/user.model");
const Organization = require("../models/organization.model");
const Report = require("../models/report.model");
const Subject = require("../models/subject.model");
const ApprovalRequest = require("../models/approval_request.model");
const Download = require("../models/download_link.model"); // Assuming this exists for downloads
const { getRecentActivities } = require("./activity_log.service");

const calculateStatistics = async () => {
  try {
    // Calculate document statistics
    const totalDocuments = await Document.countDocuments({ is_deleted: false });
    const pendingDocuments = await Document.countDocuments({
      status: "PENDING",
      is_deleted: false,
    });
    const approvedDocuments = await Document.countDocuments({
      status: "APPROVED",
      is_deleted: false,
    });
    const rejectedDocuments = await Document.countDocuments({
      status: "REJECTED",
      is_deleted: false,
    });

    // Calculate user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: "ACTIVE" });
    const inactiveUsers = await User.countDocuments({ status: "INACTIVE" });
    const bannedUsers = await User.countDocuments({ status: "BANNED" });

    // Calculate organization statistics
    const totalOrganizations = await Organization.countDocuments({
      is_deleted: false,
    });

    // Calculate report statistics
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: "PENDING" });
    const resolvedReports = await Report.countDocuments({
      status: { $in: ["RESOLVED", "DISMISSED"] },
    });

    // Calculate subject statistics
    const totalSubjects = await Subject.countDocuments({ is_deleted: false });

    // Calculate download and view statistics
    const documentStats = await Document.aggregate([
      {
        $match: { is_deleted: false },
      },
      {
        $group: {
          _id: null,
          totalDownloads: { $sum: "$download_count" },
          totalViews: { $sum: "$view" },
        },
      },
    ]);

    const totalDownloads =
      documentStats.length > 0 ? documentStats[0].totalDownloads : 0;
    const totalViews =
      documentStats.length > 0 ? documentStats[0].totalViews : 0;

    // Calculate total points from users
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalPoints: { $sum: "$point" },
        },
      },
    ]);

    const totalPoints = userStats.length > 0 ? userStats[0].totalPoints : 0;

    return {
      total_documents: totalDocuments,
      pending_documents: pendingDocuments,
      approved_documents: approvedDocuments,
      rejected_documents: rejectedDocuments,
      total_users: totalUsers,
      active_users: activeUsers,
      inactive_users: inactiveUsers,
      banned_users: bannedUsers,
      total_downloads: totalDownloads,
      total_views: totalViews,
      total_organizations: totalOrganizations,
      total_reports: totalReports,
      pending_reports: pendingReports,
      resolved_reports: resolvedReports,
      total_subjects: totalSubjects,
      total_points: totalPoints,
      last_updated: new Date(),
    };
  } catch (error) {
    console.error("Error calculating statistics:", error);
    throw new Error("Lỗi khi tính toán thống kê: " + error.message);
  }
};

const getStatistics = async (forceRefresh = false) => {
  try {
    // Try to get cached statistics
    if (!forceRefresh) {
      const cachedStats = await AdminStatistics.getCurrentStats();
      if (cachedStats) {
        return {
          success: true,
          data: cachedStats,
          cached: true,
          last_updated: cachedStats.last_updated,
        };
      }
    }

    // Calculate fresh statistics
    const freshStats = await calculateStatistics();

    // Save to database for caching
    const statsDoc = new AdminStatistics(freshStats);
    await statsDoc.save();

    return {
      success: true,
      data: statsDoc,
      cached: false,
      last_updated: freshStats.last_updated,
    };
  } catch (error) {
    console.error("Error getting statistics:", error);
    throw new Error("Lỗi khi lấy thống kê: " + error.message);
  }
};

const refreshStatistics = async () => {
  try {
    // Force refresh by calculating new statistics
    const freshStats = await calculateStatistics();

    // Update or create new statistics document
    let statsDoc = await AdminStatistics.findOne().sort({ createdAt: -1 });
    if (statsDoc) {
      await statsDoc.updateStats(freshStats);
    } else {
      statsDoc = new AdminStatistics(freshStats);
      await statsDoc.save();
    }

    return {
      success: true,
      data: statsDoc,
      message: "Thống kê đã được làm mới",
      last_updated: freshStats.last_updated,
    };
  } catch (error) {
    console.error("Error refreshing statistics:", error);
    throw new Error("Lỗi khi làm mới thống kê: " + error.message);
  }
};

const getDetailedStatistics = async (period = "all") => {
  try {
    const baseQuery = { is_deleted: false };

    // Add time-based filtering if period is specified
    let dateFilter = {};
    if (period !== "all") {
      const now = new Date();
      switch (period) {
        case "today":
          dateFilter = {
            createdAt: {
              $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            },
          };
          break;
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = { createdAt: { $gte: weekAgo } };
          break;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = { createdAt: { $gte: monthAgo } };
          break;
        default:
          break;
      }
    }

    // Get detailed breakdowns
    const [documentBreakdown, userBreakdown, reportBreakdown] =
      await Promise.all([
        // Document status breakdown
        Document.aggregate([
          { $match: { ...baseQuery, ...dateFilter } },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              totalDownloads: { $sum: "$download_count" },
              totalViews: { $sum: "$view" },
            },
          },
        ]),

        // User status breakdown
        User.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),

        // Report status breakdown
        Report.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    return {
      success: true,
      period,
      breakdowns: {
        documents: documentBreakdown,
        users: userBreakdown,
        reports: reportBreakdown,
      },
    };
  } catch (error) {
    console.error("Error getting detailed statistics:", error);
    throw new Error("Lỗi khi lấy thống kê chi tiết: " + error.message);
  }
};

const getAdminTasks = async (adminId, limit = 20) => {
  try {
    // Get approval requests assigned to this admin and still pending
    const approvalTasks = await ApprovalRequest.find({
      assigned_to: adminId,
      status: "PENDING",
    })
      .populate({
        path: "doc",
        select: "title status createdAt",
        match: { is_deleted: false },
      })
      .populate({
        path: "requester",
        select: "first_name last_name",
      })
      .sort({ createdAt: -1 })
      .limit(limit);

    // Get pending reports that need admin attention
    const reportTasks = await Report.find({
      status: "PROCESSING",
    })
      .populate({
        path: "doc",
        select: "title status",
        match: { is_deleted: false },
      })
      .populate({
        path: "reporter",
        select: "first_name last_name",
      })
      .sort({ createdAt: -1 })
      .limit(limit);

    // Transform approval requests to task format
    const approvalTaskItems = approvalTasks
      .filter((request) => request.doc) // Only include if document still exists
      .map((request) => ({
        id: request._id.toString(),
        type: "approval_request",
        title: `Duyệt tài liệu: ${request.doc.title}`,
        description: `Yêu cầu duyệt từ ${request.requester.first_name} ${request.requester.last_name}`,
        priority:
          request.ai_violation_level === "HIGH"
            ? "urgent"
            : request.ai_violation_level === "MEDIUM"
            ? "high"
            : "medium",
        status: "pending",
        createdAt: request.createdAt,
        data: {
          requestId: request._id,
          documentId: request.doc._id,
          documentTitle: request.doc.title,
          requester: request.requester,
          aiChecked: request.ai_checked,
          aiViolationLevel: request.ai_violation_level,
        },
      }));

    // Transform reports to task format
    const reportTaskItems = reportTasks
      .filter((report) => report.doc) // Only include if document still exists
      .map((report) => ({
        id: report._id.toString(),
        type: "report",
        title: `Báo cáo vi phạm: ${report.doc.title}`,
        description: `${report.type.join(", ")} - Báo cáo bởi ${
          report.reporter.first_name
        } ${report.reporter.last_name}`,
        priority: report.type.includes("COPYRIGHT") ? "urgent" : "high",
        status: "pending",
        createdAt: report.createdAt,
        data: {
          reportId: report._id,
          documentId: report.doc._id,
          documentTitle: report.doc.title,
          reporter: report.reporter,
          violationTypes: report.type,
          reason: report.reason,
        },
      }));

    // Combine and sort by priority and creation date
    const allTasks = [...approvalTaskItems, ...reportTaskItems]
      .sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, limit);

    return allTasks;
  } catch (error) {
    console.error("Error getting admin tasks:", error);
    throw new Error("Lỗi khi lấy danh sách công việc: " + error.message);
  }
};

/**
 * Lấy hoạt động gần đây từ tất cả user
 * @param {Number} limit - Số lượng hoạt động cần lấy
 */
const getRecentActivitiesForAdmin = async (limit = 30) => {
  try {
    const result = await getRecentActivities({ limit });

    if (!result.success) {
      throw new Error("Không thể lấy danh sách hoạt động");
    }

    // Format activities for admin dashboard
    const formattedActivities = result.activities.map((activity) => {
      const redirectInfo = getRedirectInfo(
        activity.action,
        activity.target_type,
        activity.target_id,
        activity.metadata
      );

      return {
        id: activity._id,
        user: {
          id: activity.user._id,
          name: `${activity.user.first_name} ${activity.user.last_name}`,
          avatar: activity.user.avatar,
          email: activity.user.contact_email,
        },
        action: activity.action,
        actionLabel: getActionLabel(activity.action),
        targetType: activity.target_type,
        targetId: activity.target_id,
        targetTitle: activity.target_title,
        description: activity.description,
        metadata: activity.metadata,
        redirectTo: redirectInfo.route,
        redirectParams: redirectInfo.params,
        timestamp: activity.createdAt,
      };
    });

    return {
      success: true,
      activities: formattedActivities,
      total: formattedActivities.length,
    };
  } catch (error) {
    console.error("Error getting recent activities for admin:", error);
    throw new Error("Lỗi khi lấy hoạt động gần đây: " + error.message);
  }
};

/**
 * Convert action enum to readable label
 */
const getActionLabel = (action) => {
  const labels = {
    DOCUMENT_CREATED: "Tạo tài liệu",
    DOCUMENT_APPROVED: "Duyệt tài liệu",
    DOCUMENT_REJECTED: "Từ chối tài liệu",
    DOCUMENT_DELETED: "Xóa tài liệu",
    DOCUMENT_EDITED: "Chỉnh sửa tài liệu",
    DOCUMENT_HIDDEN: "Ẩn tài liệu",
    EDIT_REQUEST_CREATED: "Tạo yêu cầu chỉnh sửa",
    EDIT_REQUEST_APPROVED: "Duyệt yêu cầu chỉnh sửa",
    EDIT_REQUEST_REJECTED: "Từ chối yêu cầu chỉnh sửa",
    APPROVAL_REQUEST_CREATED: "Tạo yêu cầu duyệt",
    APPROVAL_REQUEST_APPROVED: "Duyệt yêu cầu",
    APPROVAL_REQUEST_REJECTED: "Từ chối yêu cầu",
    REPORT_CREATED: "Tạo báo cáo vi phạm",
    REPORT_RESOLVED: "Giải quyết báo cáo",
    REPORT_DISMISSED: "Bỏ qua báo cáo",
    COMMENT_CREATED: "Tạo bình luận",
    COMMENT_DELETED: "Xóa bình luận",
    USER_BANNED: "Cấm người dùng",
    USER_UNBANNED: "Gỡ cấm người dùng",
    ORGANIZATION_CREATED: "Tạo tổ chức",
    ORGANIZATION_UPDATED: "Cập nhật tổ chức",
    SUBJECT_CREATED: "Tạo môn học",
    SUBJECT_UPDATED: "Cập nhật môn học",
  };
  return labels[action] || action;
};

/**
 * Xác định route và params để điều hướng dựa trên action và target
 */
const getRedirectInfo = (action, targetType, targetId, metadata = {}) => {
  const redirectInfo = {
    route: null,
    params: {},
  };

  switch (targetType) {
    case "Document":
      if (action.includes("APPROVAL_REQUEST")) {
        // Điều hướng đến trang quản lý approval requests
        redirectInfo.route = "/admin/approval-requests";
        redirectInfo.params = {
          requestId: metadata.requestId || targetId,
          documentId: metadata.documentId || targetId,
        };
      } else if (action.includes("EDIT_REQUEST")) {
        // Điều hướng đến trang quản lý edit requests
        redirectInfo.route = "/admin/edit-requests";
        redirectInfo.params = {
          requestId: metadata.requestId || targetId,
          documentId: metadata.documentId || targetId,
        };
      } else {
        // Điều hướng đến chi tiết document
        redirectInfo.route = "/documents/:id";
        redirectInfo.params = { id: targetId };
      }
      break;

    case "Report":
      // Điều hướng đến trang quản lý reports
      redirectInfo.route = "/admin/reports";
      redirectInfo.params = {
        reportId: targetId,
        documentId: metadata.documentId,
      };
      break;

    case "Comment":
      // Điều hướng đến document với focus vào comment
      redirectInfo.route = "/documents/:id";
      redirectInfo.params = {
        id: metadata.documentId || targetId,
        commentId: targetId,
      };
      break;

    case "User":
      // Điều hướng đến profile user
      redirectInfo.route = "/users/:id";
      redirectInfo.params = { id: targetId };
      break;

    case "ApprovalRequest":
      // Điều hướng đến trang quản lý approval requests
      redirectInfo.route = "/admin/approval-requests";
      redirectInfo.params = {
        requestId: targetId,
        documentId: metadata.documentId,
      };
      break;

    case "EditApproval":
      // Điều hướng đến trang quản lý edit approvals
      redirectInfo.route = "/admin/edit-requests";
      redirectInfo.params = {
        requestId: targetId,
        documentId: metadata.documentId,
      };
      break;

    case "Organization":
      // Điều hướng đến trang quản lý organizations
      redirectInfo.route = "/admin/organizations";
      redirectInfo.params = { id: targetId };
      break;

    case "Subject":
      // Điều hướng đến trang quản lý subjects
      redirectInfo.route = "/admin/subjects";
      redirectInfo.params = { id: targetId };
      break;

    default:
      // Không có route cụ thể
      redirectInfo.route = null;
      redirectInfo.params = {};
  }

  return redirectInfo;
};

module.exports = {
  calculateStatistics,
  getStatistics,
  refreshStatistics,
  getDetailedStatistics,
  getAdminTasks,
  getRecentActivitiesForAdmin,
};
