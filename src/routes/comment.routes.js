const express = require("express");
const router = express.Router();
const commentController = require("../controllers/comment.controller");
const {
  requireUserRole,
  userOrUnauthenticated,
  requireLoggedIn,
} = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /comments/documents/{documentId}:
 *   post:
 *     summary: Tạo bình luận mới cho tài liệu
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tài liệu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Nội dung bình luận
 *                 example: "Tài liệu rất hay và bổ ích!"
 *               parentId:
 *                 type: string
 *                 description: ID của bình luận gốc (nếu là reply)
 *                 example: null
 *             required:
 *               - content
 *     responses:
 *       201:
 *         description: Tạo bình luận thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/documents/:documentId",
  requireLoggedIn,
  commentController.createComment
);

/**
 * @swagger
 * /comments/documents/{documentId}:
 *   get:
 *     summary: Lấy danh sách bình luận của tài liệu
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tài liệu
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
 *         description: Số lượng bình luận mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách bình luận thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/documents/:documentId",
  userOrUnauthenticated,
  commentController.getCommentsByDocument
);

/**
 * @swagger
 * /comments/{commentId}/replies:
 *   get:
 *     summary: Lấy danh sách replies của một bình luận
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bình luận gốc
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
 *         description: Số lượng replies mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách replies thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/:commentId/replies",
  userOrUnauthenticated,
  commentController.getRepliesByComment
);

/**
 * @swagger
 * /comments/{commentId}:
 *   put:
 *     summary: Cập nhật nội dung bình luận
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bình luận
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Nội dung bình luận mới
 *                 example: "Cập nhật: Tài liệu rất hay và bổ ích!"
 *             required:
 *               - content
 *     responses:
 *       200:
 *         description: Cập nhật bình luận thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền chỉnh sửa
 *       500:
 *         description: Lỗi server
 */
router.put("/:commentId", requireLoggedIn, commentController.updateComment);

/**
 * @swagger
 * /comments/{commentId}:
 *   delete:
 *     summary: Xóa bình luận
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bình luận
 *     responses:
 *       200:
 *         description: Xóa bình luận thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền xóa
 *       500:
 *         description: Lỗi server
 */
router.delete("/:commentId", requireLoggedIn, commentController.deleteComment);

/**
 * @swagger
 * /comments/documents/{documentId}/stats:
 *   get:
 *     summary: Lấy thống kê bình luận của tài liệu
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tài liệu
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/documents/:documentId/stats",
  userOrUnauthenticated,
  commentController.getCommentStats
);

module.exports = router;
