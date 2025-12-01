const express = require("express");
const router = express.Router();
const adminStatisticsController = require("../controllers/admin_statistics.controller");
const { requireLoggedIn } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /admin/statistics:
 *   get:
 *     summary: Lấy tất cả thông tin thống kê cho trang dashboard
 *     tags: [Admin Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: force_refresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Buộc làm mới thống kê thay vì dùng cache
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
 *                   type: object
 *                   properties:
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         total_documents:
 *                           type: integer
 *                           description: Tổng số tài liệu
 *                           example: 1250
 *                         pending_documents:
 *                           type: integer
 *                           description: Tài liệu chờ duyệt
 *                           example: 23
 *                         total_users:
 *                           type: integer
 *                           description: Tổng số người dùng
 *                           example: 856
 *                         total_downloads:
 *                           type: integer
 *                           description: Tổng lượt tải xuống
 *                           example: 5432
 *                         total_views:
 *                           type: integer
 *                           description: Tổng lượt xem
 *                           example: 12890
 *                         total_organizations:
 *                           type: integer
 *                           description: Tổng số tổ chức
 *                           example: 45
 *                         total_reports:
 *                           type: integer
 *                           description: Tổng số báo cáo
 *                           example: 127
 *                         banned_users:
 *                           type: integer
 *                           description: Người dùng bị cấm
 *                           example: 23
 *                         approved_documents:
 *                           type: integer
 *                           description: Tài liệu đã duyệt
 *                           example: 1200
 *                         active_users:
 *                           type: integer
 *                           description: Người dùng đang hoạt động
 *                           example: 800
 *                         pending_reports:
 *                           type: integer
 *                           description: Báo cáo chờ xử lý
 *                           example: 15
 *                         total_subjects:
 *                           type: integer
 *                           description: Tổng số môn học
 *                           example: 50
 *                     recent_activities:
 *                       type: array
 *                       description: Danh sách hoạt động gần đây
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: ID của hoạt động
 *                           type:
 *                             type: string
 *                             enum: [DOCUMENT_APPROVED, DOCUMENT_EDIT_REQUESTED, DOCUMENT_DELETED, DOCUMENT_UPLOADED, USER_CREATED, ORGANIZATION_CREATED, SUBJECT_CREATED, USER_BANNED, USER_UNBANNED, REPORT_RESOLVED]
 *                             description: Loại hoạt động
 *                           description:
 *                             type: string
 *                             description: Mô tả hoạt động
 *                           actor:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 description: Tên người thực hiện
 *                               role:
 *                                 type: string
 *                                 description: Vai trò của người thực hiện
 *                               avatar:
 *                                 type: string
 *                                 description: URL avatar
 *                           target:
 *                             type: object
 *                             description: Đối tượng bị ảnh hưởng
 *                           color:
 *                             type: string
 *                             enum: [success, warning, danger, info]
 *                             description: Màu sắc cho UI
 *                           icon:
 *                             type: string
 *                             description: Icon cho UI
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: Thời gian tạo
 *                     tasks:
 *                       type: array
 *                       description: Danh sách công việc cần làm
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: ID của công việc
 *                           type:
 *                             type: string
 *                             enum: [approval_request, report]
 *                             description: Loại công việc
 *                           title:
 *                             type: string
 *                             description: Tiêu đề công việc
 *                           description:
 *                             type: string
 *                             description: Mô tả chi tiết
 *                           priority:
 *                             type: string
 *                             enum: [low, medium, high, urgent]
 *                             description: Độ ưu tiên
 *                           status:
 *                             type: string
 *                             enum: [pending, in_progress, completed]
 *                             description: Trạng thái
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: Thời gian tạo
 *                           data:
 *                             type: object
 *                             description: Dữ liệu bổ sung cho công việc
 *                 cached:
 *                   type: boolean
 *                   description: Dữ liệu có phải từ cache không
 *                   example: false
 *                 last_updated:
 *                   type: string
 *                   format: date-time
 *                   description: Thời gian cập nhật cuối
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 *   post:
 *     summary: Làm mới thống kê (tính toán lại từ database)
 *     tags: [Admin Statistics]
 *     security:
 *       - bearerAuth: []
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
 *                   type: object
 *                   description: Dữ liệu thống kê mới
 *                 message:
 *                   type: string
 *                   example: "Thống kê đã được làm mới"
 *                 last_updated:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.get("/", requireLoggedIn, adminStatisticsController.getDashboardStats);

router.post("/", adminStatisticsController.refreshStatistics);

module.exports = router;
