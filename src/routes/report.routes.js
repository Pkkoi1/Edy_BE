const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { requireUserRole, userOrUnauthenticated, requireLoggedIn, refreshToken, requireAdminPermission } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Tạo báo cáo mới
 *     tags:
 *       - Reports
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               docId:
 *                 type: string
 *                 example: "652e1c8e2f8b9c0012345678"
 *               cmtId:
 *                 type: string
 *                 example: "652e1c8e2f8b9c0012345679"
 *               type:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["INAPPROPRIATE", "COPYRIGHT"]
 *                 description: Các loại báo cáo được xác định là hợp lệ
 *               reason:
 *                 type: string
 *                 example: "Nội dung không phù hợp"
 *     responses:
 *       201:
 *         description: Tạo báo cáo thành công
 *       400:
 *         description: Thông tin báo cáo không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Tài khoản bị hạn chế
 */
router.post("/", requireUserRole, reportController.createReport);

/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Lấy danh sách báo cáo
 *     tags:
 *       - Reports
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['PROCESSING', 'RESOLVED']
 *           example: "PROCESSING"
 *         description: Trạng thái của báo cáo để lọc
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: ['SPAM_OR_MISLEADING', 'DUPLICATE', 'COPYRIGHT', 'INCORRECT_CATEGORY', 'PERSONAL_INFORMATION', 'LOW_QUALITY', 'INAPPROPRIATE', 'OTHER']
 *         description: Loại báo cáo để lọc 
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search theo title document hoặc reason
 *     responses:
 *       200:
 *         description: Lấy danh sách báo cáo thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: không có quyền
 */
router.get("/", requireAdminPermission(['HANDLE_REPORT']), reportController.getAllReports);

/**
 * @swagger
 * /reports/{reportId}/resolve:
 *   put:
 *     summary: Xử lý báo cáo
 *     tags:
 *       - Reports
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *           example: "652e1c8e2f8b9c0012345678"
 *         description: ID của báo cáo cần xử lý
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               validTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["INAPPROPRIATE"]
 *                 description: Các loại báo cáo được xác định là hợp lệ
 *               action:
 *                 type: string
 *                 example: "DELETE"
 *                 enum: ['EDIT_REQUESTED', 'DELETE', 'FALSE_REPORT']
 *                 description: Hành động được thực hiện
 *               resolveReason:
 *                 type: string
 *                 example: "Nội dung vi phạm chính sách cộng đồng"
 *                 description: Lý do xử lý báo cáo
 *     responses:
 *       200:
 *         description: Xử lý báo cáo thành công
 *       400:
 *         description: Thông tin xử lý không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: không có quyền
 *       404:
 *         description: Báo cáo không tồn tại
 */
router.put("/:reportId/resolve", requireAdminPermission(['HANDLE_REPORT']), reportController.resolveReport);

module.exports = router;