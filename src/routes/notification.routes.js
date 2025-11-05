const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const {
  requireLoggedIn,
  requireAdminPermission,
} = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Lấy danh sách thông báo của người dùng
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng thông báo mỗi trang
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Lọc theo trạng thái đọc (true=đã đọc, false=chưa đọc, không có=tất cả)
 *     responses:
 *       200:
 *         description: Lấy danh sách thông báo thành công
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get("/", requireLoggedIn, notificationController.getNotifications);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Lấy số lượng thông báo chưa đọc
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: Lấy số lượng thông báo chưa đọc thành công
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/unread-count",
  requireLoggedIn,
  notificationController.getUnreadCount
);

/**
 * @swagger
 * /notifications/stats:
 *   get:
 *     summary: Lấy thống kê thông báo
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: Lấy thống kê thông báo thành công
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/stats",
  requireLoggedIn,
  notificationController.getNotificationStats
);

/**
 * @swagger
 * /notifications/{notificationId}/read:
 *   patch:
 *     summary: Đánh dấu thông báo đã đọc
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thông báo
 *     responses:
 *       200:
 *         description: Đánh dấu đã đọc thành công
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Thông báo không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.patch(
  "/:notificationId/read",
  requireLoggedIn,
  notificationController.markAsRead
);

/**
 * @swagger
 * /notifications/mark-all-read:
 *   patch:
 *     summary: Đánh dấu tất cả thông báo đã đọc
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: Đánh dấu tất cả đã đọc thành công
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.patch(
  "/mark-all-read",
  requireLoggedIn,
  notificationController.markAllAsRead
);

/**
 * @swagger
 * /notifications/{notificationId}:
 *   delete:
 *     summary: Xóa thông báo
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thông báo
 *     responses:
 *       200:
 *         description: Xóa thông báo thành công
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Thông báo không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.delete(
  "/:notificationId",
  requireLoggedIn,
  notificationController.deleteNotification
);

/**
 * @swagger
 * /notifications/delete-all-read:
 *   delete:
 *     summary: Xóa tất cả thông báo đã đọc
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: Xóa tất cả thông báo đã đọc thành công
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.delete(
  "/delete-all-read",
  requireLoggedIn,
  notificationController.deleteAllRead
);

/**
 * @swagger
 * /notifications/create:
 *   post:
 *     summary: Tạo thông báo mới
 *     tags:
 *       - Notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID người nhận thông báo
 *                 example: "652e1c8e2f8b9c0012345678"
 *               docId:
 *                 type: string
 *                 description: ID tài liệu liên quan (tùy chọn)
 *                 example: "652e1c8e2f8b9c0012345679"
 *               cmtId:
 *                 type: string
 *                 description: ID bình luận liên quan (tùy chọn)
 *                 example: "652e1c8e2f8b9c001234567a"
 *               type:
 *                 type: string
 *                 enum: [APPROVED, REMOVED, REJECTED, HIDDEN, SYSTEM, COMMENT, REPLY]
 *                 description: Loại thông báo
 *                 example: "SYSTEM"
 *               message:
 *                 type: string
 *                 description: Nội dung thông báo
 *                 example: "Chúc mừng bạn đã hoàn thành nhiệm vụ!"
 *               redirectTo:
 *                 type: string
 *                 description: URL điều hướng (tùy chọn, null nếu không điều hướng)
 *                 example: "/documents/652e1c8e2f8b9c0012345679"
 *             required:
 *               - userId
 *               - type
 *               - message
 *     responses:
 *       201:
 *         description: Tạo thông báo thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/create",
  requireLoggedIn,
  notificationController.createNotification
);

module.exports = router;
