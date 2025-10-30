const express = require("express");
const router = express.Router();
const userStatisticsController = require("../controllers/user_statistics.controller");
const { requireLoggedIn } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /user-statistics/me:
 *   get:
 *     summary: Lấy thống kê cá nhân của người dùng hiện tại
 *     tags: [User Statistics]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Năm cần lấy thống kê (mặc định là năm hiện tại)
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy thống kê
 *       500:
 *         description: Lỗi server
 */
router.get("/me", requireLoggedIn, userStatisticsController.getMyStatistics);

/**
 * @swagger
 * /user-statistics/sync:
 *   post:
 *     summary: Đồng bộ thống kê cá nhân
 *     tags: [User Statistics]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Năm cần đồng bộ (mặc định là năm hiện tại)
 *     responses:
 *       200:
 *         description: Đồng bộ thành công
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/sync",
  requireLoggedIn,
  userStatisticsController.syncMyStatistics
);

/**
 * @swagger
 * /user-statistics/year/{year}:
 *   get:
 *     summary: Lấy thống kê cá nhân theo năm cụ thể
 *     tags: [User Statistics]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: Năm cần lấy thống kê
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *       400:
 *         description: Năm không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy thống kê
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/year/:year",
  requireLoggedIn,
  userStatisticsController.getStatisticsByYear
);

module.exports = router;
