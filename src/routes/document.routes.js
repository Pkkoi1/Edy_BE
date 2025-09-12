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
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo từ khóa, tiêu đề, tác giả, keyword
 *       - in: query
 *         name: ordering
 *         schema:
 *           type: string
 *         description: "Trường sắp xếp (vd: title, createdAt, published_year)"
 *       - in: query
 *         name: order
 *         schema:
 *           type: integer
 *           enum: [1, -1]
 *         description: 1 là tăng dần, -1 là giảm dần
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số lượng tài liệu mỗi trang
 *       - in: query
 *         name: organization
 *         schema:
 *           type: string
 *         description: Lọc theo tổ chức
 *       - in: query
 *         name: publisher
 *         schema:
 *           type: string
 *         description: Lọc theo nhà xuất bản
 *       - in: query
 *         name: published_year
 *         schema:
 *           type: integer
 *         description: Lọc theo năm xuất bản
 *       - in: query
 *         name: intensive
 *         schema:
 *           type: boolean
 *         description: Lọc theo chuyên ngành
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Lọc theo tác giả
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Lọc theo người đăng
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Lọc theo từ khóa
 *       - in: query
 *         name: doc_type
 *         schema:
 *           type: string
 *         description: Lọc theo loại tài liệu
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *         description: Lọc theo trình độ
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Lọc theo môn
 *     responses:
 *       200:
 *         description: Lấy danh sách tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.get("/newest", userOrUnauthenticated, documentController.getNewestDocuments);

module.exports = router;