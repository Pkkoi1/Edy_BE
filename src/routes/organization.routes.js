const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organization.controller");
const {
  requireUserRole,
  userOrUnauthenticated,
  requireLoggedIn,
  refreshToken,
  requireAdminPermission,
} = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /organizations:
 *   get:
 *     summary: Lấy danh sách tổ chức
 *     tags:
 *       - Organizations
 *     parameters:
 *       - in: query
 *         name: is_dropdown
 *         schema:
 *           type: boolean
 *         example: false
 *     responses:
 *       200:
 *         description: Lấy danh sách tổ chức thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.get("/", organizationController.getOrganizations);

/**
 * @swagger
 * /organizations:
 *   post:
 *     summary: Tạo tổ chức mới
 *     tags:
 *       - Organizations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "ABC University"
 *               code:
 *                 type: string
 *                 example: "ABCUNI"
 *               description:
 *                 type: string
 *                 example: "Trường đại học hàng đầu"
 *               country:
 *                 type: string
 *                 example: "Vietnam"
 *               address:
 *                 type: string
 *                 example: "123 Main St"
 *               website:
 *                 type: string
 *                 example: "https://abcuni.edu.vn"
 *     responses:
 *       201:
 *         description: Tạo tổ chức thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.post("/", requireLoggedIn, organizationController.createOrganization);

/**
 * @swagger
 * /organizations/{id}:
 *   get:
 *     summary: Lấy thông tin tổ chức theo ID
 *     tags:
 *       - Organizations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tổ chức
 *     responses:
 *       200:
 *         description: Lấy thông tin tổ chức thành công
 *       404:
 *         description: Tổ chức không tồn tại
 */
router.get(
  "/:id",
  userOrUnauthenticated,
  organizationController.getOrganizationById
);

/**
 * @swagger
 * /organizations/{id}:
 *   put:
 *     summary: Cập nhật thông tin tổ chức
 *     tags:
 *       - Organizations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tổ chức
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "ABC University"
 *               code:
 *                 type: string
 *                 example: "ABCUNI"
 *               description:
 *                 type: string
 *                 example: "Trường đại học hàng đầu"
 *               country:
 *                 type: string
 *                 example: "Vietnam"
 *               address:
 *                 type: string
 *                 example: "123 Main St"
 *               website:
 *                 type: string
 *                 example: "https://abcuni.edu.vn"
 *     responses:
 *       200:
 *         description: Cập nhật tổ chức thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Tổ chức không tồn tại
 */
router.put("/:id", requireLoggedIn, organizationController.updateOrganization);

/**
 * @swagger
 * /organizations/{id}:
 *   delete:
 *     summary: Xóa tổ chức
 *     tags:
 *       - Organizations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID tổ chức
 *     responses:
 *       200:
 *         description: Xóa tổ chức thành công
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Tổ chức không tồn tại
 */
router.delete(
  "/:id",
  requireLoggedIn,
  organizationController.deleteOrganization
);

module.exports = router;
