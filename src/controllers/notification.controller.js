const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  getUnreadCount,
  getNotificationStats,
  createNotification,
} = require("../services/notification.service");

// Lấy danh sách thông báo
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, isRead } = req.query;

    // Parse isRead parameter
    let isReadFilter = null;
    if (isRead === "true") isReadFilter = true;
    if (isRead === "false") isReadFilter = false;

    const result = await getNotifications(
      userId,
      parseInt(page),
      parseInt(limit),
      isReadFilter
    );

    res.json(result);
  } catch (error) {
    console.error("Lỗi lấy danh sách thông báo:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy danh sách thông báo: " + error.message,
    });
  }
};

// Đánh dấu thông báo đã đọc
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await markAsRead(notificationId, userId);

    res.json({
      message: "Đã đánh dấu thông báo là đã đọc",
      notification,
    });
  } catch (error) {
    console.error("Lỗi đánh dấu đã đọc:", error);

    if (
      error.message.includes("không tồn tại") ||
      error.message.includes("không có quyền")
    ) {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi đánh dấu đã đọc: " + error.message,
    });
  }
};

// Đánh dấu tất cả thông báo đã đọc
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await markAllAsRead(userId);

    res.json(result);
  } catch (error) {
    console.error("Lỗi đánh dấu tất cả đã đọc:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi đánh dấu tất cả đã đọc: " + error.message,
    });
  }
};

// Xóa thông báo
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const result = await deleteNotification(notificationId, userId);

    res.json(result);
  } catch (error) {
    console.error("Lỗi xóa thông báo:", error);

    if (
      error.message.includes("không tồn tại") ||
      error.message.includes("không có quyền")
    ) {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi xóa thông báo: " + error.message,
    });
  }
};

// Xóa tất cả thông báo đã đọc
exports.deleteAllRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await deleteAllRead(userId);

    res.json(result);
  } catch (error) {
    console.error("Lỗi xóa thông báo đã đọc:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi xóa thông báo đã đọc: " + error.message,
    });
  }
};

// Lấy số lượng thông báo chưa đọc
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await getUnreadCount(userId);

    res.json(result);
  } catch (error) {
    console.error("Lỗi lấy số thông báo chưa đọc:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy số thông báo chưa đọc: " + error.message,
    });
  }
};

// Lấy thống kê thông báo
exports.getNotificationStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const stats = await getNotificationStats(userId);

    res.json(stats);
  } catch (error) {
    console.error("Lỗi lấy thống kê thông báo:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy thống kê thông báo: " + error.message,
    });
  }
};

// Tạo thông báo thủ công (Admin only)
exports.createNotification = async (req, res) => {
  try {
    const { userId, docId, cmtId, type, message } = req.body;

    // Validation
    if (!userId || !type || !message) {
      return res.status(400).json({
        message: "userId, type và message là bắt buộc",
      });
    }

    const validTypes = [
      "APPROVED",
      "REMOVED",
      "REJECTED",
      "HIDDEN",
      "SYSTEM",
      "COMMENT",
      "REPLY",
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: `Type phải là một trong: ${validTypes.join(", ")}`,
      });
    }

    if (message.trim().length > 500) {
      return res.status(400).json({
        message: "Nội dung thông báo không được vượt quá 500 ký tự",
      });
    }

    const notification = await createNotification({
      userId,
      docId,
      cmtId,
      type,
      message: message.trim(),
    });

    res.status(201).json({
      message: "Tạo thông báo thành công",
      notification,
      status: 201,
    });
  } catch (error) {
    console.error("Lỗi tạo thông báo:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi tạo thông báo: " + error.message,
    });
  }
};
