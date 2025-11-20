const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const Document = require("../models/document.model");
const Comment = require("../models/comment.model");
const mongoose = require("mongoose");

// Tạo thông báo mới
const createNotification = async ({
  userId,
  docId = null,
  cmtId = null,
  type,
  message,
  redirectTo = null,
}) => {
  try {
    // Kiểm tra user tồn tại
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Kiểm tra document nếu có
    if (docId) {
      const document = await Document.findById(docId);
      if (!document) {
        throw new Error("Tài liệu không tồn tại");
      }
    }

    // Kiểm tra comment nếu có
    if (cmtId) {
      const comment = await Comment.findById(cmtId);
      if (!comment) {
        throw new Error("Bình luận không tồn tại");
      }
    }

    // Tạo thông báo
    const notification = new Notification({
      user: userId,
      doc: docId,
      cmt: cmtId,
      type,
      message: message.trim(),
      isRead: false,
      redirectTo,
    });

    await notification.save();

    // Populate thông tin liên quan
    await notification.populate([
      { path: "doc", select: "_id title" },
      { path: "cmt", select: "_id content" },
    ]);

    return notification;
  } catch (error) {
    throw new Error(`Lỗi tạo thông báo: ${error.message}`);
  }
};

// Lấy danh sách thông báo của user
const getNotifications = async (
  userId,
  page = 1,
  limit = 10,
  isRead = null
) => {
  try {
    const skip = (page - 1) * limit;

    // Build query
    let query = { user: userId };
    if (isRead !== null) {
      query.isRead = isRead;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate({
          path: "doc",
          select: "_id title cover_page",
        })
        .populate({
          path: "cmt",
          select: "_id content",
          populate: {
            path: "user",
            select: "_id first_name last_name avatar",
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);
    const have_next = page < totalPages;

    return {
      notifications,
      total,
      page,
      totalPages,
      have_next,
    };
  } catch (error) {
    throw new Error(`Lỗi lấy danh sách thông báo: ${error.message}`);
  }
};

// Đánh dấu thông báo đã đọc
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId,
    });

    if (!notification) {
      throw new Error(
        "Thông báo không tồn tại hoặc bạn không có quyền truy cập"
      );
    }

    notification.isRead = true;
    await notification.save();

    return notification;
  } catch (error) {
    throw new Error(`Lỗi đánh dấu đã đọc: ${error.message}`);
  }
};

// Đánh dấu tất cả thông báo đã đọc
const markAllAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );

    return {
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
      modified_count: result.modifiedCount,
    };
  } catch (error) {
    throw new Error(`Lỗi đánh dấu tất cả đã đọc: ${error.message}`);
  }
};

// Xóa thông báo
const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId,
    });

    if (!notification) {
      throw new Error("Thông báo không tồn tại hoặc bạn không có quyền xóa");
    }

    return { message: "Xóa thông báo thành công" };
  } catch (error) {
    throw new Error(`Lỗi xóa thông báo: ${error.message}`);
  }
};

// Xóa tất cả thông báo đã đọc
const deleteAllRead = async (userId) => {
  try {
    const result = await Notification.deleteMany({
      user: userId,
      isRead: true,
    });

    return {
      message: "Xóa tất cả thông báo đã đọc thành công",
      deleted_count: result.deletedCount,
    };
  } catch (error) {
    throw new Error(`Lỗi xóa thông báo đã đọc: ${error.message}`);
  }
};

// Lấy số lượng thông báo chưa đọc
const getUnreadCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    return { unread_count: count };
  } catch (error) {
    throw new Error(`Lỗi lấy số thông báo chưa đọc: ${error.message}`);
  }
};

// Lấy thống kê thông báo
const getNotificationStats = async (userId) => {
  try {
    const [total, unread, byType] = await Promise.all([
      Notification.countDocuments({ user: userId }),
      Notification.countDocuments({ user: userId, isRead: false }),
      Notification.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      total_notifications: total,
      unread_notifications: unread,
      read_notifications: total - unread,
      by_type: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  } catch (error) {
    throw new Error(`Lỗi lấy thống kê thông báo: ${error.message}`);
  }
};

// Helper functions để tạo các loại thông báo cụ thể

// Thông báo tài liệu được duyệt
const notifyDocumentApproved = async (userId, documentId) => {
  const document = await Document.findById(documentId);
  if (!document) return;

  return await createNotification({
    userId,
    docId: documentId,
    type: "APPROVED",
    message: `Tài liệu "${document.title}" của bạn đã được phê duyệt và xuất bản thành công! 🎉`,
    redirectTo: "DOCUMENT",
  });
};

// Thông báo tài liệu bị từ chối
const notifyDocumentRejected = async (userId, documentId, reason = "") => {
  const document = await Document.findById(documentId);
  if (!document) return;

  const message = reason
    ? `Tài liệu "${document.title}" của bạn bị từ chối. Lý do: ${reason}`
    : `Tài liệu "${document.title}" của bạn bị từ chối. Vui lòng kiểm tra lại nội dung.`;

  return await createNotification({
    userId,
    docId: documentId,
    type: "REJECTED",
    message,
    redirectTo: "DOCUMENT",
  });
};

// Thông báo tài liệu bị xóa
const notifyDocumentRemoved = async (userId, documentId, reason = "") => {
  const document = await Document.findById(documentId);
  if (!document) return;

  const message = reason
    ? `Tài liệu "${document.title}" của bạn đã bị xóa. Lý do: ${reason}`
    : `Tài liệu "${document.title}" của bạn đã bị xóa khỏi hệ thống.`;

  return await createNotification({
    userId,
    docId: documentId,
    type: "REMOVED",
    message,
    redirectTo: "NONE", // Tài liệu đã bị xóa, không thể điều hướng
  });
};

// Thông báo tài liệu bị ẩn
const notifyDocumentHidden = async (userId, documentId, reason = "") => {
  const document = await Document.findById(documentId);
  if (!document) return;

  const message = reason
    ? `Tài liệu "${document.title}" đã được đặt về chế độ riêng tư. Lý do: ${reason}`
    : `Tài liệu "${document.title}" đã được đặt về chế độ riêng tư và cần chỉnh sửa.`;

  return await createNotification({
    userId,
    docId: documentId,
    type: "HIDDEN",
    message,
    redirectTo: "DOCUMENT",
  });
};

// Thông báo bình luận mới
const notifyNewComment = async (documentOwnerId, commentId, commenterName) => {
  const comment = await Comment.findById(commentId).populate("doc", "title");
  if (!comment || comment.user.toString() === documentOwnerId) return;

  return await createNotification({
    userId: documentOwnerId,
    docId: comment.doc._id,
    cmtId: commentId,
    type: "COMMENT",
    message: `${commenterName} đã bình luận về tài liệu "${comment.doc.title}" của bạn 💬`,
    redirectTo: "COMMENT",
  });
};

// Thông báo trả lời bình luận
const notifyCommentReply = async (
  originalCommenterId,
  replyId,
  replierName
) => {
  const reply = await Comment.findById(replyId).populate([
    { path: "doc", select: "title" },
    { path: "parent", select: "content" },
  ]);

  if (!reply || reply.user.toString() === originalCommenterId) return;

  return await createNotification({
    userId: originalCommenterId,
    docId: reply.doc._id,
    cmtId: replyId,
    type: "REPLY",
    message: `${replierName} đã trả lời bình luận của bạn trong tài liệu "${reply.doc.title}" 💭`,
    redirectTo: "COMMENT",
  });
};

// Thông báo hệ thống
const notifySystem = async (userId, message) => {
  return await createNotification({
    userId,
    type: "SYSTEM",
    message,
    redirectTo: "NONE", // Thông báo hệ thống thường không cần điều hướng
  });
};

// Thông báo thay đổi trạng thái VIP
const notifyVipStatusChanged = async (userId, isVip) => {
  const message = isVip
    ? "🎉 Chúc mừng! Bạn đã trở thành thành viên VIP với nhiều đặc quyền hấp dẫn!"
    : "😔 Bạn đã mất trạng thái VIP. Tiếp tục tích lũy điểm để trở lại VIP nhé!";

  return await createNotification({
    userId,
    type: "SYSTEM",
    message,
    redirectTo: "USER", // Điều hướng đến trang profile của user
  });
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
  getUnreadCount,
  getNotificationStats,
  // Helper functions
  notifyDocumentApproved,
  notifyDocumentRejected,
  notifyDocumentRemoved,
  notifyDocumentHidden,
  notifyNewComment,
  notifyCommentReply,
  notifySystem,
  notifyVipStatusChanged,
};
