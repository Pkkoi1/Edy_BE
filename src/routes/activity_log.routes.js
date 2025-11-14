const express = require("express");
const router = express.Router();
const adminStatisticsController = require("../controllers/admin_statistics.controller");
const { requireAdminPermission } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /admin/recent-activities:
 *   get:
 *     summary: Lấy danh sách hoạt động gần đây cho admin dashboard
 *     tags: [Admin Recent Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Số lượng hoạt động muốn lấy
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: ID của hoạt động
 *                       type:
 *                         type: string
 *                         enum: [DOCUMENT_APPROVED, DOCUMENT_EDIT_REQUESTED, DOCUMENT_DELETED, DOCUMENT_UPLOADED, USER_CREATED, ORGANIZATION_CREATED, SUBJECT_CREATED, USER_BANNED, USER_UNBANNED, REPORT_RESOLVED]
 *                         description: Loại hoạt động
 *                       description:
 *                         type: string
 *                         description: Mô tả hoạt động
 *                       actor:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             description: Tên người thực hiện
 *                           role:
 *                             type: string
 *                             description: Vai trò của người thực hiện
 *                           avatar:
 *                             type: string
 *                             description: URL avatar
 *                       target:
 *                         type: object
 *                         description: Đối tượng bị ảnh hưởng
 *                       color:
 *                         type: string
 *                         enum: [success, warning, danger, info]
 *                         description: Màu sắc cho UI
 *                       icon:
 *                         type: string
 *                         description: Icon cho UI
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Thời gian tạo
 *       400:
 *         description: Tham số không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền admin
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/",
  requireAdminPermission(),
  adminStatisticsController.getRecentActivities
);

module.exports = router;
