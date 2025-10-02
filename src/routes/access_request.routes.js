const express = require("express");
const router = express.Router();
const accessRequestController = require("../controllers/access_request.controller");
const {
  requireUserRole,
  requireLoggedIn,
} = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /access-requests/private-share/{privateShareId}:
 *   post:
 *     summary: Tạo yêu cầu truy cập tài liệu qua private share
 *     tags:
 *       - Access Requests
 *     parameters:
 *       - in: path
 *         name: privateShareId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của private share
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Tôi cần truy cập tài liệu này để nghiên cứu cho luận văn"
 *                 description: Lý do muốn truy cập tài liệu (tùy chọn)
 *     responses:
 *       201:
 *         description: Gửi yêu cầu truy cập thành công
 *       400:
 *         description: Yêu cầu không hợp lệ hoặc đã có quyền truy cập
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/private-share/:privateShareId",
  requireUserRole,
  accessRequestController.createAccessRequest
);

/**
 * @swagger
 * /access-requests/private-share/{privateShareId}/list:
 *   get:
 *     summary: Lấy danh sách yêu cầu truy cập theo private share (chỉ chủ sở hữu)
 *     tags:
 *       - Access Requests
 *     parameters:
 *       - in: path
 *         name: privateShareId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của private share
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DENIED]
 *         description: Lọc theo trạng thái yêu cầu
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
 *         description: Số lượng yêu cầu mỗi trang
 *       - in: query
 *         name: ordering
 *         schema:
 *           type: string
 *           default: "createdAt"
 *         description: Trường sắp xếp
 *       - in: query
 *         name: order
 *         schema:
 *           type: integer
 *           enum: [1, -1]
 *           default: -1
 *         description: 1 là tăng dần, -1 là giảm dần
 *     responses:
 *       200:
 *         description: Lấy danh sách yêu cầu thành công
 *       404:
 *         description: Private share không tồn tại hoặc không có quyền truy cập
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/private-share/:privateShareId/list",
  requireUserRole,
  accessRequestController.getAccessRequestsByPrivateShare
);

/**
 * @swagger
 * /access-requests/{requestId}/approve:
 *   put:
 *     summary: Phê duyệt yêu cầu truy cập
 *     tags:
 *       - Access Requests
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của access request
 *     responses:
 *       200:
 *         description: Phê duyệt yêu cầu thành công
 *       400:
 *         description: Yêu cầu đã được xử lý hoặc đã đạt giới hạn
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền phê duyệt
 *       404:
 *         description: Yêu cầu không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.put(
  "/:requestId/approve",
  requireUserRole,
  accessRequestController.approveAccessRequest
);

/**
 * @swagger
 * /access-requests/{requestId}/deny:
 *   put:
 *     summary: Từ chối yêu cầu truy cập
 *     tags:
 *       - Access Requests
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của access request
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Tài liệu này chỉ dành cho sinh viên khóa 2024"
 *                 description: Lý do từ chối (tùy chọn)
 *     responses:
 *       200:
 *         description: Từ chối yêu cầu thành công
 *       400:
 *         description: Yêu cầu đã được xử lý
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền từ chối
 *       404:
 *         description: Yêu cầu không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.put(
  "/:requestId/deny",
  requireUserRole,
  accessRequestController.denyAccessRequest
);

/**
 * @swagger
 * /access-requests/my-requests:
 *   get:
 *     summary: Lấy danh sách yêu cầu truy cập của người dùng hiện tại
 *     tags:
 *       - Access Requests
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DENIED]
 *         description: Lọc theo trạng thái yêu cầu
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
 *         description: Số lượng yêu cầu mỗi trang
 *       - in: query
 *         name: ordering
 *         schema:
 *           type: string
 *           default: "createdAt"
 *         description: Trường sắp xếp
 *       - in: query
 *         name: order
 *         schema:
 *           type: integer
 *           enum: [1, -1]
 *           default: -1
 *         description: 1 là tăng dần, -1 là giảm dần
 *     responses:
 *       200:
 *         description: Lấy danh sách yêu cầu thành công
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/my-requests",
  requireUserRole,
  accessRequestController.getMyAccessRequests
);

/**
 * @swagger
 * /access-requests/{requestId}/cancel:
 *   delete:
 *     summary: Hủy yêu cầu truy cập (chỉ người tạo yêu cầu)
 *     tags:
 *       - Access Requests
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của access request
 *     responses:
 *       200:
 *         description: Hủy yêu cầu thành công
 *       400:
 *         description: Chỉ có thể hủy yêu cầu đang chờ xử lý
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền hủy yêu cầu này
 *       404:
 *         description: Yêu cầu không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.delete(
  "/:requestId/cancel",
  requireUserRole,
  accessRequestController.cancelAccessRequest
);

module.exports = router;
