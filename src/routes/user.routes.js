const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { requireUserRole, requireLoggedIn, refreshToken } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lấy danh sách người dùng
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
 */

router.get("/", requireUserRole, userController.getUsers);

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

module.exports = router;
