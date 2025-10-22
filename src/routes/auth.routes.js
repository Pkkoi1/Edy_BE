const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { requireLoggedIn } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập vào hệ thống
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "emailngungoc123@gmail.com"
 *               password:
 *                 type: string
 *                 example: "password"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Sai tài khoản hoặc mật khẩu
 *
 */
router.post("/login", authController.login);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Email đã được sử dụng
 */
router.post("/register", authController.register);
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Đăng xuất khỏi hệ thống
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post("/logout", requireLoggedIn, authController.logout);
/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Làm mới token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Refresh token thành công
 *       401:
 *         description: Refresh token không hợp lệ
 */
router.post("/refresh-token", requireLoggedIn, authController.refreshToken);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Lấy thông tin người dùng hiện tại
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Lấy thông tin người dùng hiện tại thành công
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 * */
router.get("/me", requireLoggedIn, authController.me);

/**
 * @swagger
 * /auth/create-otp:
 *   post:
 *     summary: Tạo và gửi OTP qua email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               type:
 *                 type: string
 *                 enum: [REGISTER, RESET_PASSWORD]
 *                 default: REGISTER
 *                 example: "REGISTER"
 *     responses:
 *       200:
 *         description: OTP đã được gửi thành công
 *       400:
 *         description: Email đã được sử dụng hoặc không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.post("/create-otp", authController.createOTP);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Xác thực OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               type:
 *                 type: string
 *                 enum: [REGISTER, RESET_PASSWORD]
 *                 default: REGISTER
 *                 example: "REGISTER"
 *     responses:
 *       200:
 *         description: OTP hợp lệ
 *       400:
 *         description: OTP không hợp lệ hoặc đã hết hạn
 *       500:
 *         description: Lỗi server
 */
router.post("/verify-otp", authController.verifyOTP);

/**
 * @swagger
 * /auth/register-with-otp:
 *   post:
 *     summary: Đăng ký tài khoản với OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: "Nguyễn"
 *               last_name:
 *                 type: string
 *                 example: "Văn A"
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: Đăng ký thành công với OTP
 *       400:
 *         description: Email đã được sử dụng hoặc OTP không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.post("/register-with-otp", authController.registerWithOTP);

module.exports = router;
