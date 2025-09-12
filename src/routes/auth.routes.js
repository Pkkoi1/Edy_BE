const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const {requireLoggedIn} = require("../middlewares/auth.middleware");

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
router.post("/logout", requireLoggedIn,authController.logout);
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

module.exports = router;
