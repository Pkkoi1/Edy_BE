const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controller");
const { requireUserRole, userOrUnauthenticated, requireLoggedIn, refreshToken, requiredAdminPermission, requireAdminPermission } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /documents/newest:
 *   get:
 *     summary: Lấy danh sách tài liệu mới nhất
 *     tags:
 *       - Documents
 *     responses:
 *       200:
 *         description: Lấy danh sách tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.get("/newest", userOrUnauthenticated, documentController.getNewestDocuments);

module.exports = router;