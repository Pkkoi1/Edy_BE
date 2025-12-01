const express = require("express");
const router = express.Router();
const adminRoleController = require("../controllers/admin_role.controller");
const {
  requireUserRole,
  userOrUnauthenticated,
  requireLoggedIn,
  refreshToken,
  requireAdminPermission,
} = require("../middlewares/auth.middleware");

// ROLE ROUTES
/**
 * @swagger
 * /admin/roles:
 *   get:
 *     summary: Lấy tất cả các vai trò
 *     tags: [Role]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên hoặc mã vai trò (regex, case insensitive)
 *       - in: query
 *         name: description
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo mô tả vai trò (regex, case insensitive)
 *       - in: query
 *         name: permissions
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Lọc theo quyền (array)
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái hoạt động
 *     responses:
 *       200:
 *         description: Thành công
 *       401:
 *         description: Không có quyền truy cập
 */
router.get(
  "/roles",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.getAllRoles
);
router.get(
  "/roles/:roleId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.getRoleById
);

/**
 * @swagger
 * /admin/roles:
 *   post:
 *     summary: Tạo mới một vai trò
 *     tags: [Role]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên vai trò
 *                 example: "ADMIN"
 *                 required: true
 *               code:
 *                 type: string
 *                 description: Mã vai trò
 *                 enum: [
 *                   'SUPER_ADMIN',
 *                   'DOCUMENT_ADMIN',
 *                   'USER_ADMIN',
 *                   'SYSTEM_ADMIN',
 *                   'ENTITY_ADMIN',
 *                   'CUSTOM_ROLE'
 *                 ]
 *                 example: "ADMIN"
 *                 required: true
 *               description:
 *                 type: string
 *                 description: Mô tả vai trò
 *                 example: "Vai trò quản trị viên"
 *                 required: true
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách quyền của vai trò
 *                 example: ["MANAGE_ROLE"]
 *                 required: true
 *     responses:
 *       201:
 *         description: Thành công
 *       401:
 *         description: Không có quyền truy cập
 */
router.post(
  "/roles",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.createRole
);

/**
 * @swagger
 * /admin/roles/{roleId}:
 *   put:
 *     summary: Cập nhật thông tin vai trò
 *     tags: [Role]
 *     parameters:
 *       - in: path
 *         name: roleId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của vai trò cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên vai trò
 *                 example: "ADMIN"
 *               description:
 *                 type: string
 *                 description: Mô tả vai trò
 *                 example: "Vai trò quản trị viên"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum:
 *                     - MANAGE_DOCUMENT
 *                     - HANDLE_REPORT
 *                     - MANAGE_USER
 *                     - MANAGE_COMMENT
 *                     - MANAGE_SERVER
 *                     - MANAGE_ENTITY
 *                     - MANAGE_ROLE
 *                     - ALL
 *                 description: Danh sách quyền của vai trò
 *                 example: ["MANAGE_ROLE"]
 *             required:
 *               - permissions
 *     responses:
 *       200:
 *         description: Thành công
 *       401:
 *         description: Không có quyền truy cập
 */
router.put(
  "/roles/:roleId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.updateRole
);
router.patch(
  "/roles/:roleId/status",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.changeRoleStatus
);
router.delete(
  "/roles/:roleId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.deleteRole
);

// ASSIGNMENT ROUTES
router.get(
  "/assignments/user/:userId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.getAllAssignmentsByAccount
);
router.get(
  "/assignments/role/:roleId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.getAllAssignmentsByRole
);
router.get(
  "/assignments/:assignmentId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.getAssignmentById
);

/**
 * @swagger
 * /admin/assignments:
 *   post:
 *     summary: Tạo mới một gán vai trò
 *     tags: [Assignment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account:
 *                 type: string
 *                 description: ID của tài khoản
 *                 example: "60d0fe4f5311236168a109ca"
 *                 required: true
 *               role:
 *                 type: string
 *                 description: ID của vai trò
 *                 example: "60d0fe4f5311236168a109cb"
 *                 required: true
 *               subject:
 *                 type: string
 *                 description: ID của môn học
 *                 example: "60d0fe4f5311236168a109cc"
 *                 required: true
 *               organization:
 *                 type: string
 *                 description: ID của tổ chức
 *                 example: "60d0fe4f5311236168a109cd"
 *                 required: true
 *     responses:
 *       201:
 *         description: Thành công
 *       401:
 *         description: Không có quyền truy cập
 */
router.post(
  "/assignments",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.createAssignment
);
router.put(
  "/assignments/:assignmentId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.updateAssignment
);
router.patch(
  "/assignments/:assignmentId/status",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.changeAssignmentStatus
);
router.delete(
  "/assignments/:assignmentId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.deleteAssignment
);

/**
 * @swagger
 * /admin/assignments:
 *   get:
 *     summary: Lấy tất cả các gán vai trò
 *     tags: [Assignment]
 *     responses:
 *       200:
 *         description: Thành công
 *       401:
 *         description: Không có quyền truy cập
 */
router.get(
  "/assignments",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.getAllAssignments
);

/**
 * @swagger
 * /admin/roles/user/{accountId}:
 *   delete:
 *     summary: Gỡ toàn bộ vai trò của một người dùng (tước quyền admin)
 *     tags: [Role]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của tài khoản cần gỡ vai trò
 *         example: "60d0fe4f5311236168a109ca"
 *     responses:
 *       200:
 *         description: Gỡ vai trò thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       description: Số lượng vai trò đã gỡ
 *                       example: 3
 *                 message:
 *                   type: string
 *                   example: "Revoked all roles for the account"
 *       400:
 *         description: Lỗi yêu cầu hoặc không có quyền
 *       401:
 *         description: Không có quyền truy cập
 */
router.delete(
  "/roles/user/:accountId",
  requireAdminPermission(["MANAGE_ROLE"]),
  adminRoleController.revokeAllRoles
);

module.exports = router;
