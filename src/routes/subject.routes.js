const express = require("express");
const router = express.Router();
const subjectController = require("../controllers/subject.controller");
const documentController = require("../controllers/document.controller");
const { requireUserRole, userOrUnauthenticated, requireLoggedIn, refreshToken, requireAdminPermission } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /subjects:
 *   post:
 *     summary: Tạo môn học mới
 *     tags:
 *       - Subjects
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Toán cao cấp"
 *               code:
 *                 type: string
 *                 example: "MATH101"
 *               description:
 *                 type: string
 *                 example: "Môn học nền tảng cho sinh viên kỹ thuật"
 *               organization:
 *                 type: string
 *                 example: "652e1c8e2f8b9c0012345678"
 *     responses:
 *       201:
 *         description: Tạo môn học thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.post("/", requireUserRole, subjectController.createSubject);

/**
 * @swagger
 * /subjects?orgId:
 *   get:
 *     summary: Lấy danh sách môn học theo tổ chức
 *     tags:
 *       - Subjects
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         example: "652e1c8e2f8b9c0012345678"
 *         schema:
 *           type: string
 *         description: ID của tổ chức
 *     responses:
 *       200:
 *         description: Lấy danh sách môn học thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.get("/", requireUserRole, subjectController.getSubjectsByOrganization);

// router.get("/:id", requireUserRole, subjectController.getSubjectById);
/**
 * @swagger
 * /subjects/{id}:
 *   get:
 *     summary: Lấy thông tin môn học theo ID
 *     tags:
 *       - Subjects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của môn học
 *     responses:
 *       200:
 *         description: Lấy thông tin môn học thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       404:
 *         description: Môn học không tồn tại
 */
router.get("/:id", requireUserRole, subjectController.getSubjectById);

/**
 * @swagger
 * /subjects/{id}/documents:
 *   get:
 *     summary: Lấy danh sách tài liệu theo môn học
 *     tags:
 *       - Subjects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của môn học
 *     responses:
 *       200:
 *         description: Lấy danh sách tài liệu thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       404:
 *         description: Môn học không tồn tại
 */
router.get("/:id/documents", userOrUnauthenticated, documentController.getDocumentsBySubject);

/**
 * @swagger
 * /subjects/{id}:
 *   put:
 *     summary: Cập nhật thông tin môn học
 *     tags:
 *       - Subjects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID môn học
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Toán cao cấp"
 *               code:
 *                 type: string
 *                 example: "MATH101"
 *               description:
 *                 type: string
 *                 example: "Môn học nền tảng cho sinh viên kỹ thuật"
 *               organization:
 *                 type: string
 *                 example: "652e1c8e2f8b9c0012345678"
 *     responses:
 *       200:
 *         description: Cập nhật môn học thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền
 */
//router.put("/:id", requireAdminPermission(['MANAGE_ENTITY']), subjectController.updateSubject);

module.exports = router;