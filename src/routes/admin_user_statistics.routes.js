const express = require("express");
const router = express.Router();
const adminUserStatisticsController = require("../controllers/admin_user_statistics.controller");
const {
  requireLoggedIn,
  requireAdminPermission,
} = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /admin-user-statistics:
 *   get:
 *     summary: Lấy thống kê người dùng cho admin
 *     tags: [Admin User Statistics]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Năm cần lấy thống kê. Nếu chỉ truyền year, sẽ trả về thống kê cho cả năm đó
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Tháng cần lấy thống kê (chỉ sử dụng khi muốn thống kê theo tháng cụ thể)
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     year:
 *                       type: integer
 *                     month:
 *                       type: integer
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         activeUsers:
 *                           type: integer
 *                         inactiveUsers:
 *                           type: integer
 *                         bannedUsers:
 *                           type: integer
 *                         newUsers:
 *                           type: integer
 *                     monthlyNewUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                           newUsers:
 *                             type: integer
 *                   description: Response khi lấy thống kê theo tháng
 *                 - type: object
 *                   properties:
 *                     year:
 *                       type: integer
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         activeUsers:
 *                           type: integer
 *                         inactiveUsers:
 *                           type: integer
 *                         bannedUsers:
 *                           type: integer
 *                         newUsers:
 *                           type: integer
 *                     monthlyStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                           totalUsers:
 *                             type: integer
 *                           activeUsers:
 *                             type: integer
 *                           inactiveUsers:
 *                             type: integer
 *                           bannedUsers:
 *                             type: integer
 *                           newUsers:
 *                             type: integer
 *                   description: Response khi lấy thống kê theo năm
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền admin
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/",
  requireLoggedIn,
  requireAdminPermission([]),
  adminUserStatisticsController.getAdminUserStatistics
);

/**
 * @swagger
 * /admin-user-statistics/users:
 *   get:
 *     summary: Lấy danh sách người dùng cho admin
 *     tags: [Admin User Statistics]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Số lượng người dùng mỗi trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm theo tên
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền admin
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/users",
  requireLoggedIn,
  requireAdminPermission([]),
  adminUserStatisticsController.getUsersList
);

/**
 * @swagger
 * /admin-user-statistics/sync:
 *   post:
 *     summary: Đồng bộ thống kê người dùng theo tháng hoặc theo năm
 *     tags: [Admin User Statistics]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Năm cần đồng bộ. Nếu chỉ truyền year, sẽ đồng bộ tất cả tháng trong năm đó
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Tháng cần đồng bộ (chỉ sử dụng khi muốn đồng bộ theo tháng cụ thể)
 *     responses:
 *       200:
 *         description: Đồng bộ thành công
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     year:
 *                       type: integer
 *                     syncedMonths:
 *                       type: integer
 *                   description: Response khi đồng bộ theo năm
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     year:
 *                       type: integer
 *                     month:
 *                       type: integer
 *                     lastSyncAt:
 *                       type: string
 *                       format: date-time
 *                   description: Response khi đồng bộ theo tháng
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền admin
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/sync",
  requireLoggedIn,
  requireAdminPermission([]),
  adminUserStatisticsController.syncAdminUserStatistics
);

module.exports = router;
