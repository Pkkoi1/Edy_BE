const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controller");
const { requireUserRole, userOrUnauthenticated, requireLoggedIn, refreshToken, requireAdminPermission } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /documents/newest:
 *   get:
 *     summary: Lấy danh sách tài liệu mới nhất
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo từ khóa, tiêu đề, tác giả, keyword
 *       - in: query
 *         name: ordering
 *         schema:
 *           type: string
 *         description: "Trường sắp xếp (vd: title, createdAt, published_year)"
 *       - in: query
 *         name: order
 *         schema:
 *           type: integer
 *           enum: [1, -1]
 *         description: 1 là tăng dần, -1 là giảm dần
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số lượng tài liệu mỗi trang
 *       - in: query
 *         name: organization
 *         schema:
 *           type: string
 *         description: Lọc theo tổ chức
 *       - in: query
 *         name: publisher
 *         schema:
 *           type: string
 *         description: Lọc theo nhà xuất bản
 *       - in: query
 *         name: published_year
 *         schema:
 *           type: integer
 *         description: Lọc theo năm xuất bản
 *       - in: query
 *         name: intensive
 *         schema:
 *           type: boolean
 *         description: Lọc theo chuyên ngành
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Lọc theo tác giả
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Lọc theo người đăng
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Lọc theo từ khóa
 *       - in: query
 *         name: doc_type
 *         schema:
 *           type: string
 *         description: Lọc theo loại tài liệu
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *         description: Lọc theo trình độ
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Lọc theo môn
 *     responses:
 *       200:
 *         description: Lấy danh sách tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.get("/newest", userOrUnauthenticated, documentController.getNewestDocuments);

/**
 * @swagger
 * /documents:
 *   post:
 *     summary: Tải lên tài liệu mới
 *     tags:
 *       - Documents
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 example: "https://res.cloudinary.com/demo/document.pdf"
 *               title:
 *                 type: string
 *                 example: "Giáo trình Toán cao cấp"
 *               doc_type:
 *                 type: string
 *                 enum:
 *                   - Research Report
 *                   - Video
 *                   - Study Guide
 *                   - Textbook
 *                   - Essay
 *                   - Solution Set
 *                   - Thesis
 *                   - Lecture
 *                   - Other
 *                 example: "Research Report"
 *               file_type:
 *                 type: string
 *                 enum:
 *                   - Word
 *                   - PDF
 *                   - Excel
 *                   - Video
 *                   - Powerpoint
 *                 example: "PDF"
 *               subject:
 *                 type: string
 *                 example: "652e1c8e2f8b9c0012345679"
 *               author:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Nguyễn Văn A", "Trần Thị B"]
 *               published_year:
 *                 type: integer
 *                 example: 2024
 *               publisher:
 *                 type: string
 *                 example: "NXB Giáo dục"
 *               organization:
 *                 type: string
 *                 example: "652e1c8e2f8b9c0012345678"
 *               level:
 *                 type: string
 *                 enum:
 *                   - Student
 *                   - University
 *                   - Lecturer
 *                   - Researcher
 *                   - Other
 *                 example: "University"
 *               intensive:
 *                 type: boolean
 *                 example: false
 *               keyword:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["toán", "cao cấp"]
 *               description:
 *                 type: string
 *                 example: "Tài liệu toán cao cấp dành cho sinh viên năm nhất."
 *               page:
 *                 type: integer
 *                 example: 120
 *     responses:
 *       201:
 *         description: Tải lên tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.post("/", requireUserRole, documentController.uploadDocument);

/**
 * @swagger
 * /documents/pending:
 *    get:
 *     summary: Lấy danh sách tài liệu đang chờ phê duyệt
 *     tags:
 *       - Documents
 *     responses:
 *       200:
 *         description: Lấy danh sách tài liệu thành công
 *       403:
 *         description: Không có quyền
 *       500:
 *         description: Lỗi server
 */
router.get("/pending", requireAdminPermission(['MANAGE_DOCUMENT']), documentController.getPendingDocuments);

/**
 * @swagger
 * /documents/pending-requests/{id}:
 *   get:
 *     summary: Lấy danh sách yêu cầu phê duyệt tài liệu
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tài liệu
 *     responses:
 *       200:
 *         description: Lấy danh sách yêu cầu phê duyệt tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền
 */
router.get("/pending-requests/:documentId", requireAdminPermission(['MANAGE_DOCUMENT']), documentController.getPendingRequestsByDocument);

/**
 * @swagger
 * /documents/approve/{id}:
 *   put:
 *     summary: Phê duyệt tài liệu
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID request
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isIntensive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Phê duyệt tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền
 */
router.put("/approve/:requestId", requireAdminPermission(['MANAGE_DOCUMENT']), documentController.approveDocument);
/**
 * @swagger
 * /documents/reject/{id}:
 *   put:
 *     summary: Từ chối tài liệu
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID request
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Tài liệu không phù hợp với quy định của hệ thống."
 *                 description: Tin nhắn từ chối (nếu có)
 *     responses:
 *       200:
 *         description: Từ chối tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền
 */
router.put("/reject/:requestId", requireAdminPermission(['MANAGE_DOCUMENT']), documentController.rejectDocument);

/**
 * @swagger
 * /documents/my-documents:
 *   get:
 *     summary: Lấy danh sách tài liệu của người dùng hiện tại
 *     tags:
 *       - Documents
 *     responses:
 *       200:
 *         description: Lấy danh sách tài liệu thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */

router.get("/my-documents", requireLoggedIn, documentController.getMyDocuments);

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết tài liệu theo ID
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tài liệu
 *     responses:
 *       200:
 *         description: Lấy thông tin tài liệu thành công
 *       404:
 *         description: Tài liệu không tồn tại hoặc bạn không có quyền truy cập
 *       500:
 *         description: Đã xảy ra lỗi khi lấy tài liệu
 */
router.get("/:id", userOrUnauthenticated, documentController.getDocumentById);


module.exports = router;