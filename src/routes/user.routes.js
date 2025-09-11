const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { requireUserRole } = require("../middlewares/auth.middleware");

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

module.exports = router;
