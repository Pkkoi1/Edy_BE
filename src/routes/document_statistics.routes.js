const express = require("express");
const router = express.Router();
const documentStatisticsController = require("../controllers/document_statistics.controller");
const { requireLoggedIn } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /document-statistics:
 *   get:
 *     summary: Lấy thống kê tài liệu theo năm/tháng
 *     tags: [Document Statistics]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Năm cần lấy thống kê (mặc định là năm hiện tại)
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Tháng cần lấy thống kê (tùy chọn)
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalDocuments:
 *                       type: integer
 *                       example: 200
 *                     totalViews:
 *                       type: integer
 *                       example: 111200
 *                     totalDownloads:
 *                       type: integer
 *                       example: 12112
 *                 documentTypes:
 *                   type: object
 *                   example: {"Tiêu luận": 5, "Nghiên cứu khoa học": 4, "Khác": 2}
 *                 topDocuments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       document:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       title:
 *                         type: string
 *                         example: "Tài liệu ứng hộp Kinh tế chính trị Mác Lênin"
 *                       views:
 *                         type: integer
 *                         example: 154
 *                       downloads:
 *                         type: integer
 *                         example: 28
 *                       rating:
 *                         type: string
 *                         example: "84%"
 *                 approvedDocuments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       document:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       title:
 *                         type: string
 *                         example: "Tài liệu ứng hộp Kinh tế chính trị Mác Lênin"
 *                       author:
 *                         type: string
 *                         example: "Nguyễn Văn A"
 *                       subject:
 *                         type: string
 *                         example: "Kinh tế chính trị"
 *                       uploadDate:
 *                         type: string
 *                         format: date
 *                         example: "2025-01-15"
 *                       approvedDate:
 *                         type: string
 *                         format: date
 *                         example: "2025-01-16"
 *                       approvedBy:
 *                         type: string
 *                         example: "AI"
 *                       status:
 *                         type: string
 *                         example: "Đã duyệt"
 *                 monthlyData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         example: "T1"
 *                       views:
 *                         type: integer
 *                         example: 25000
 *                       downloads:
 *                         type: integer
 *                         example: 2500
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-01T00:00:00.000Z"
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/",
  requireLoggedIn,
  documentStatisticsController.getDocumentStatistics
);

/**
 * @swagger
 * /document-statistics/generate:
 *   post:
 *     summary: Đồng bộ thống kê tài liệu theo tháng/năm
 *     tags: [Document Statistics]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               year:
 *                 type: integer
 *                 description: Năm cần đồng bộ thống kê (mặc định là năm hiện tại)
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 description: Tháng cần đồng bộ thống kê (mặc định là tháng hiện tại)
 *     responses:
 *       200:
 *         description: Đồng bộ thống kê thành công
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/generate",
  requireLoggedIn,
  documentStatisticsController.syncMonthStatistics
);

/**
 * @swagger
 * /document-statistics/generate-all:
 *   post:
 *     summary: Đồng bộ thống kê cho toàn bộ hệ thống và đồng bộ document IDs
 *     tags: [Document Statistics]
 *     responses:
 *       200:
 *         description: Đồng bộ thống kê thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đồng bộ thống kê cho toàn bộ hệ thống thành công. Đã đồng bộ thành công 5 bản ghi thống kê"
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/generate-all",
  requireLoggedIn,
  documentStatisticsController.syncAllStatistics
);

module.exports = router;
