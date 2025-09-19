const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const {
  requireUserRole,
  requireLoggedIn,
  refreshToken,
  requiredAdminPermission,
  requireAdminPermission,
} = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lấy danh sách người dùng yêu cầu quyền quản lý người dùng
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: Lỗi server
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền
 */
router.get(
  "/",
  requireAdminPermission(["MANAGE_USER"]),
  userController.getUsers
);

/**
 * @swagger
 * /users/verify:
 *   put:
 *     summary: Thêm các thuộc tính cần thiết để xác minh tài khoản
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organization:
 *                 type: string
 *               field_of_study:
 *                 type: string
 *     responses:
 *       200:
 *         description: Xác minh thành công
 *       400:
 *         description: Mã xác minh không hợp lệ
 */
router.put("/verify", requireLoggedIn, userController.verifyUser);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Cập nhật thông tin cá nhân (họ, tên, tổ chức, avatar)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: "Nguyễn"
 *                 description: "Họ của người dùng (không bắt buộc)"
 *               last_name:
 *                 type: string
 *                 example: "Văn A"
 *                 description: "Tên của người dùng (không bắt buộc)"
 *               organization:
 *                 type: string
 *                 example: "60f1b2b8e1b9a72b8c8b4567"
 *                 description: "ID tổ chức (không bắt buộc, giới hạn thay đổi 30 ngày/lần)"
 *               avatar:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *                 description: "URL avatar của người dùng (không bắt buộc)"
 *     responses:
 *       200:
 *         description: Cập nhật thông tin thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
router.put("/profile", requireLoggedIn, userController.updateProfile);

/**
 * @swagger
 * /users/change-password:
 *   put:
 *     summary: Thay đổi mật khẩu
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_password
 *               - new_password
 *             properties:
 *               current_password:
 *                 type: string
 *                 example: "old_password123"
 *               new_password:
 *                 type: string
 *                 example: "new_password123"
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu hiện tại không đúng hoặc dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
router.put("/change-password", requireLoggedIn, userController.changePassword);

module.exports = router;
