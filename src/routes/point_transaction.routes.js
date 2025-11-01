const express = require("express");
const router = express.Router();
const pointTransactionController = require("../controllers/point_transaction.controller");
const { requireLoggedIn } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /point-transactions/spend:
 *   post:
 *     summary: Sử dụng điểm của người dùng
 *     tags: [Point Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reason
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 description: Số điểm cần trừ
 *                 example: 10
 *               reason:
 *                 type: string
 *                 description: Lý do sử dụng điểm
 *                 example: "Download tài liệu premium"
 *     responses:
 *       200:
 *         description: Sử dụng điểm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sử dụng điểm thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         first_name:
 *                           type: string
 *                         last_name:
 *                           type: string
 *                         point:
 *                           type: number
 *                           example: 90
 *                     spent_amount:
 *                       type: number
 *                       example: 10
 *                     remaining_points:
 *                       type: number
 *                       example: 90
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc không đủ điểm
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.post("/spend", requireLoggedIn, pointTransactionController.spendPoints);

/**
 * @swagger
 * /point-transactions/earn:
 *   post:
 *     summary: Cộng điểm cho người dùng
 *     tags: [Point Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reason
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 description: Số điểm cần cộng
 *                 example: 20
 *               reason:
 *                 type: string
 *                 description: Lý do cộng điểm
 *                 example: "Tài liệu được duyệt công khai"
 *     responses:
 *       200:
 *         description: Cộng điểm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Cộng điểm thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         first_name:
 *                           type: string
 *                         last_name:
 *                           type: string
 *                         point:
 *                           type: number
 *                           example: 120
 *                         rank_point:
 *                           type: number
 *                           example: 120
 *                     earned_amount:
 *                       type: number
 *                       example: 20
 *                     total_points:
 *                       type: number
 *                       example: 120
 *                     total_rank_points:
 *                       type: number
 *                       example: 120
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.post("/earn", requireLoggedIn, pointTransactionController.earnPoints);

/**
 * @swagger
 * /point-transactions/penalize:
 *   post:
 *     summary: Phạt điểm người dùng (Admin only)
 *     tags: [Point Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *               - reason
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID của người dùng bị phạt
 *                 example: "60d5ecb74b24c72b8c8b4567"
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 description: Số điểm hạng cần trừ
 *                 example: 10
 *               reason:
 *                 type: string
 *                 description: Lý do phạt điểm
 *                 example: "Vi phạm bản quyền"
 *     responses:
 *       200:
 *         description: Phạt điểm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Phạt điểm thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         first_name:
 *                           type: string
 *                         last_name:
 *                           type: string
 *                         rank_point:
 *                           type: number
 *                           example: 90
 *                         strike:
 *                           type: number
 *                           example: 1
 *                         status:
 *                           type: string
 *                           example: "ACTIVE"
 *                     penalized_amount:
 *                       type: number
 *                       example: 10
 *                     remaining_rank_points:
 *                       type: number
 *                       example: 90
 *                     new_strike:
 *                       type: number
 *                       example: 1
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc không đủ điểm
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/penalize",
  requireLoggedIn,
  pointTransactionController.penalizeUser
);

/**
 * @swagger
 * /point-transactions/{userId}/history:
 *   get:
 *     summary: Lấy lịch sử tích điểm của người dùng
 *     tags: [Point Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng
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
 *           default: 10
 *         description: Số lượng bản ghi mỗi trang
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [EARN, SPEND]
 *                           point:
 *                             type: number
 *                           reason:
 *                             type: string
 *                           pointType:
 *                             type: string
 *                             enum: [BOTH, USAGE, RANKPOINT]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           user:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               first_name:
 *                                 type: string
 *                               last_name:
 *                                 type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 */
router.get(
  "/:userId/history",
  requireLoggedIn,
  pointTransactionController.getPointHistoryByUserId
);

module.exports = router;
