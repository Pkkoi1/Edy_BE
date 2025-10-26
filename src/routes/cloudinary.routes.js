const express = require("express");
const router = express.Router();
const cloudinaryController = require("../controllers/cloudinary.controller");
const { requireLoggedIn } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /cloudinary/delete-file:
 *   delete:
 *     summary: Xóa file từ Cloudinary
 *     tags: [Cloudinary]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileUrl
 *             properties:
 *               fileUrl:
 *                 type: string
 *                 description: URL của file cần xóa (hình ảnh, PDF, tài liệu, etc.)
 *                 example: "https://res.cloudinary.com/demo/image/upload/v1234567890/document.pdf"
 *     responses:
 *       200:
 *         description: Xóa file thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Xóa file thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     public_id:
 *                       type: string
 *                       example: "document"
 *                     result:
 *                       type: string
 *                       example: "ok"
 *       400:
 *         description: URL file không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy file
 *       500:
 *         description: Lỗi server
 */
router.delete("/delete-file", requireLoggedIn, cloudinaryController.deleteFile);

/**
 * @swagger
 * /cloudinary/file-info:
 *   post:
 *     summary: Lấy thông tin file từ Cloudinary
 *     tags: [Cloudinary]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileUrl
 *             properties:
 *               fileUrl:
 *                 type: string
 *                 description: URL của file cần lấy thông tin (hình ảnh, PDF, tài liệu, etc.)
 *                 example: "https://res.cloudinary.com/demo/image/upload/v1234567890/document.pdf"
 *     responses:
 *       200:
 *         description: Lấy thông tin file thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Lấy thông tin file thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     public_id:
 *                       type: string
 *                       example: "document"
 *                     format:
 *                       type: string
 *                       example: "pdf"
 *                     version:
 *                       type: number
 *                       example: 1234567890
 *                     resource_type:
 *                       type: string
 *                       example: "image"
 *                     type:
 *                       type: string
 *                       example: "upload"
 *                     created_at:
 *                       type: string
 *                       example: "2023-01-01T00:00:00Z"
 *                     bytes:
 *                       type: number
 *                       example: 12345
 *                     width:
 *                       type: number
 *                       example: 1920
 *                     height:
 *                       type: number
 *                       example: 1080
 *                     url:
 *                       type: string
 *                       example: "https://res.cloudinary.com/demo/image/upload/v1234567890/document.pdf"
 *                     secure_url:
 *                       type: string
 *                       example: "https://res.cloudinary.com/demo/image/upload/v1234567890/document.pdf"
 *       400:
 *         description: URL file không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy file
 *       500:
 *         description: Lỗi server
 */
router.post("/file-info", requireLoggedIn, cloudinaryController.getFileInfo);

module.exports = router;
