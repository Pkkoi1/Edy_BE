const express = require("express");
const router = express.Router();
const documentController = require("../controllers/document.controller");
const privateShareController = require("../controllers/private_share.controller");
const {
  requireUserRole,
  userOrUnauthenticated,
  requireLoggedIn,
  refreshToken,
  requireAdminPermission,
} = require("../middlewares/auth.middleware");

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
 *         description: "Trường sắp xếp (vd: title, createdAt, published_year, last_approved_at)"
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
router.get(
  "/newest",
  userOrUnauthenticated,
  documentController.getNewestDocuments
);

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
router.get(
  "/pending",
  requireAdminPermission(["MANAGE_DOCUMENT"]),
  documentController.getPendingDocuments
);

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
router.get(
  "/pending-requests/:documentId",
  requireAdminPermission(["MANAGE_DOCUMENT"]),
  documentController.getPendingRequestsByDocument
);

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
router.put(
  "/approve/:requestId",
  requireAdminPermission(["MANAGE_DOCUMENT"]),
  documentController.approveDocument
);
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
router.put(
  "/reject/:requestId",
  requireAdminPermission(["MANAGE_DOCUMENT"]),
  documentController.rejectDocument
);

/**
 * @swagger
 * /documents/my-documents:
 *   get:
 *     summary: Lấy danh sách tài liệu của người dùng hiện tại
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Lọc theo trạng thái tài liệu
 *     responses:
 *       200:
 *         description: Lấy danh sách tài liệu thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.get("/my-documents", requireLoggedIn, documentController.getMyDocuments);

/**
 * @swagger
 * /documents/{documentId}/download:
 *   post:
 *     summary: Tạo link tải tài liệu
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tài liệu
 *     responses:
 *       200:
 *         description: Tạo link tải tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền truy cập tài liệu
 *       404:
 *         description: Tài liệu không tồn tại
 *       500:
 *         description: Đã xảy ra lỗi khi tạo link tải tài liệu
 */
router.post(
  "/:documentId/download",
  requireLoggedIn,
  documentController.createDownloadLink
);

/**
 * @swagger
 * /documents/download/{linkId}:
 *   get:
 *     summary: Tải tài liệu bằng link tải
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID link tải
 *     responses:
 *       200:
 *         description: Tải tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Link tải đã hết hạn hoặc bạn không có quyền truy cập tài liệu
 *       404:
 *         description: Link tải không tồn tại
 *       500:
 *         description: Đã xảy ra lỗi khi tải tài liệu
 */
router.get(
  "/download/:linkId",
  requireLoggedIn,
  documentController.downloadFile
);

/**
 * @swagger
 * /documents/{documentId}/share-links:
 *   post:
 *     summary: Tạo link chia sẻ cho một tài liệu
 *     tags:
 *       - Private Shares
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của tài liệu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Link chia sẻ Toán cao cấp"
 *               limited_access:
 *                 type: integer
 *                 example: 100
 *                 description: Số người truy cập tối đa (null nếu không giới hạn)
 *               request:
 *                 type: boolean
 *                 example: false
 *                 description: Yêu cầu phê duyệt từ chủ sở hữu (true/false)
 *               time_limited:
 *                 type: boolean
 *                 example: false
 *                 description: Giới hạn thời gian truy cập (true/false)
 *               start_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-01T00:00:00Z"
 *                 description: Ngày bắt đầu (nếu time_limited = true)
 *               end_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-12-31T23:59:59Z"
 *                 description: Ngày kết thúc (nếu time_limited = true)
 *     responses:
 *       201:
 *         description: Tạo link chia sẻ thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 */
router.post(
  "/:documentId/share-links",
  requireUserRole,
  privateShareController.createShareLink
);

/**
 * @swagger
 * /documents/{documentId}/share-links:
 *   get:
 *     summary: Lấy danh sách link chia sẻ của một tài liệu
 *     tags:
 *       - Private Shares
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của tài liệu
 *     responses:
 *       200:
 *         description: Lấy danh sách link chia sẻ thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 */
router.get(
  "/:documentId/share-links",
  requireUserRole,
  privateShareController.getShareLinks
);

/**
 * @swagger
 * /documents/share/{linkId}/access:
 *   post:
 *     summary: Truy cập tài liệu qua link chia sẻ
 *     tags:
 *       - Private Shares
 *     parameters:
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của link chia sẻ
 *     responses:
 *       200:
 *         description: Truy cập thành công
 *       202:
 *         description: Link chia sẻ yêu cầu phê duyệt từ chủ sở hữu
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Link chia sẻ không tồn tại
 */
router.post(
  "/share/:linkId/access",
  requireUserRole,
  privateShareController.accessShareLink
);

/**
 * @swagger
 * /documents/share-links/{linkId}/status:
 *   patch:
 *     summary: Cập nhật trạng thái (ACTIVE/INACTIVE/DISABLED) của link chia sẻ
 *     tags:
 *       - Private Shares
 *     parameters:
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema:
 *           type: string
 *         example: "652e1c8e2f8b9c0012345678"
 *         description: ID của link chia sẻ
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "ACTIVE"
 *                 description: Trạng thái mới (ACTIVE, INACTIVE, DISABLED)
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Link chia sẻ không tồn tại
 */
router.patch(
  "/share-links/:linkId/status",
  requireUserRole,
  privateShareController.updateShareLinkStatus
);

/**
 * @swagger
 * /documents/{id}/public-mode:
 *   patch:
 *     summary: Cập nhật chế độ công khai của tài liệu
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tài liệu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               public_mode:
 *                 type: string
 *                 enum:
 *                   - PUBLIC
 *                   - PRIVATE
 *                   - SHARE_ORGANIZATION
 *                 example: "PUBLIC"
 *                 description: Chế độ công khai mới
 *     responses:
 *       200:
 *         description: Cập nhật chế độ công khai thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền thực hiện thao tác này
 *       404:
 *         description: Tài liệu không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.patch(
  "/:id/public-mode",
  requireUserRole,
  documentController.updateDocumentPublicMode
);

/**
 * @swagger
 * /documents/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái của tài liệu (Admin only)
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tài liệu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum:
 *                   - PENDING
 *                   - APPROVED
 *                   - REJECTED
 *                   - REQUESTED_EDIT
 *                   - PENDING_EDIT
 *                 example: "APPROVED"
 *                 description: Trạng thái mới
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền thực hiện thao tác này
 *       404:
 *         description: Tài liệu không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.patch(
  "/:id/status",
  requireAdminPermission(["MANAGE_DOCUMENT"]),
  documentController.updateDocumentStatus
);

/**
 * @swagger
 * /documents/{id}/update:
 *   put:
 *     summary: Cập nhật thông tin tài liệu
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tài liệu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cover_page:
 *                 type: string
 *                 example: "https://res.cloudinary.com/demo/image/upload/cover.jpg"
 *                 description: URL ảnh bìa
 *               title:
 *                 type: string
 *                 example: "Giáo trình Toán cao cấp"
 *                 description: Tiêu đề tài liệu
 *               subject:
 *                 type: string
 *                 example: "652e1c8e2f8b9c0012345679"
 *                 description: ID môn học
 *               organization:
 *                 type: string
 *                 example: "652e1c8e2f8b9c0012345678"
 *                 description: ID tổ chức
 *               doc_type:
 *                 type: string
 *                 enum:
 *                   - RESEARCH_REPORT
 *                   - VIDEO
 *                   - STUDY_GUIDE
 *                   - TEXTBOOK
 *                   - ESSAY
 *                   - SOLUTION_SET
 *                   - THESIS
 *                   - LECTURE
 *                   - OTHER
 *                 example: "TEXTBOOK"
 *                 description: Loại tài liệu
 *               page:
 *                 type: integer
 *                 example: 120
 *                 description: Số trang
 *               level:
 *                 type: string
 *                 enum:
 *                   - STUDENT
 *                   - UNIVERSITY
 *                   - LECTURER
 *                   - RESEARCHER
 *                   - OTHER
 *                 example: "UNIVERSITY"
 *                 description: Trình độ
 *               description:
 *                 type: string
 *                 example: "Tài liệu toán cao cấp dành cho sinh viên năm nhất"
 *                 description: Tóm tắt do người dùng
 *               publisher:
 *                 type: string
 *                 example: "NXB Giáo dục"
 *                 description: Nhà xuất bản
 *               published_year:
 *                 type: integer
 *                 example: 2024
 *                 description: Năm xuất bản
 *               author:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Nguyễn Văn A", "Trần Thị B"]
 *                 description: Danh sách tác giả
 *               keyword:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["toán", "cao cấp", "đại học"]
 *                 description: Từ khóa
 *     responses:
 *       200:
 *         description: Cập nhật thông tin tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền thực hiện thao tác này
 *       404:
 *         description: Tài liệu không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.put("/:id/update", requireUserRole, documentController.updateDocumentInfo);

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
