const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organization.controller");
const { requireUserRole, userOrUnauthenticated, requireLoggedIn, refreshToken, requireAdminPermission } = require("../middlewares/auth.middleware");

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

module.exports = router;