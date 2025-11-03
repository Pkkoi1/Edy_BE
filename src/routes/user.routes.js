const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const {
  requireUserRole,
  requireLoggedIn,
  refreshToken,
  requiredAdminPermission,
  requireAdminPermission,
} = require("../middlewares/auth.middleware");

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lấy danh sách người dùng với phân trang, tìm kiếm và lọc (yêu cầu quyền quản lý người dùng)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang (bắt đầu từ 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Số lượng user mỗi trang (1-100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm (tên, email, hoặc ObjectId)
 *       - in: query
 *         name: field_of_study
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: true
 *         description: Lọc theo lĩnh vực học (có thể truyền nhiều giá trị)
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [ACTIVE, INACTIVE, BANNED]
 *         style: form
 *         explode: true
 *         description: Lọc theo trạng thái tài khoản (có thể truyền nhiều giá trị)
 *       - in: query
 *         name: rank_point_min
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Lọc điểm hạng tối thiểu
 *       - in: query
 *         name: rank_point_max
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Lọc điểm hạng tối đa
 *       - in: query
 *         name: strike_min
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Lọc số strike tối thiểu
 *       - in: query
 *         name: strike_max
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Lọc số strike tối đa
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
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: ID của user
 *                       first_name:
 *                         type: string
 *                         description: Họ
 *                       last_name:
 *                         type: string
 *                         description: Tên
 *                       email:
 *                         type: string
 *                         description: Email
 *                       avatar:
 *                         type: string
 *                         description: URL avatar
 *                       organization:
 *                         type: object
 *                         description: Thông tin tổ chức
 *                       field_of_study:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Lĩnh vực học
 *                       rank_point:
 *                         type: number
 *                         description: Điểm hạng
 *                       strike:
 *                         type: number
 *                         description: Số lần vi phạm
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, INACTIVE, BANNED]
 *                         description: Trạng thái tài khoản
 *                       account:
 *                         type: object
 *                         description: Thông tin tài khoản
 *                       roles:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Danh sách vai trò
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Ngày tạo
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     totalUsers:
 *                       type: integer
 *                       example: 250
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Tham số không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/",
  requireAdminPermission(["MANAGE_USER"]),
  userController.getUsers
);

/**
 * @swagger
 * /users/verify:
 *   put:
 *     summary: Thêm các thuộc tính cần thiết để xác minh tài khoản
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organization:
 *                 type: string
 *               field_of_study:
 *                 type: string
 *     responses:
 *       200:
 *         description: Xác minh thành công
 *       400:
 *         description: Mã xác minh không hợp lệ
 */
router.put("/verify", requireLoggedIn, userController.verifyUser);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Cập nhật thông tin cá nhân (họ, tên, tổ chức, avatar)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: "Nguyễn"
 *                 description: "Họ của người dùng (không bắt buộc)"
 *               last_name:
 *                 type: string
 *                 example: "Văn A"
 *                 description: "Tên của người dùng (không bắt buộc)"
 *               organization:
 *                 type: string
 *                 example: "60f1b2b8e1b9a72b8c8b4567"
 *                 description: "ID tổ chức (không bắt buộc, giới hạn thay đổi 30 ngày/lần)"
 *               avatar:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *                 description: "URL avatar của người dùng (không bắt buộc)"
 *     responses:
 *       200:
 *         description: Cập nhật thông tin thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
router.put("/profile", requireLoggedIn, userController.updateProfile);

/**
 * @swagger
 * /users/field-of-study:
 *   put:
 *     summary: Cập nhật lĩnh vực học của người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - field_of_study
 *             properties:
 *               field_of_study:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Công nghệ thông tin", "Kỹ thuật phần mềm"]
 *                 description: "Danh sách lĩnh vực học của người dùng"
 *     responses:
 *       200:
 *         description: Cập nhật lĩnh vực học thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
router.put(
  "/field-of-study",
  requireLoggedIn,
  userController.updateFieldOfStudy
);

/**
 * @swagger
 * /users/change-password:
 *   put:
 *     summary: Thay đổi mật khẩu
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_password
 *               - new_password
 *             properties:
 *               current_password:
 *                 type: string
 *                 example: "old_password123"
 *               new_password:
 *                 type: string
 *                 example: "new_password123"
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu hiện tại không đúng hoặc dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
router.put("/change-password", requireLoggedIn, userController.changePassword);

/**
 * @swagger
 * /users/favorites:
 *   get:
 *     summary: Lấy danh sách tài liệu yêu thích của người dùng hiện tại
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: Danh sách tài liệu yêu thích
 *       401:
 *         description: Chưa xác thực
 */
router.get("/favorites", requireUserRole, userController.getFavoriteDocuments);

/**
 * @swagger
 * /users/favorites/{documentId}:
 *   post:
 *     summary: Thêm tài liệu vào danh sách yêu thích
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tài liệu
 *     responses:
 *       200:
 *         description: Thêm tài liệu yêu thích thành công
 *       400:
 *         description: Yêu cầu không hợp lệ (ví dụ đã yêu thích, vượt quá giới hạn)
 */
router.post(
  "/favorites/:documentId",
  requireUserRole,
  userController.addFavoriteDocument
);

/**
 * @swagger
 * /users/favorites/{documentId}:
 *   delete:
 *     summary: Xóa tài liệu khỏi danh sách yêu thích
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tài liệu
 *     responses:
 *       200:
 *         description: Xóa tài liệu yêu thích thành công
 *       400:
 *         description: Yêu cầu không hợp lệ (ví dụ tài liệu không trong danh sách yêu thích)
 */
router.delete(
  "/favorites/:documentId",
  requireUserRole,
  userController.removeFavoriteDocument
);

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     summary: Lấy thông tin chi tiết của một người dùng theo ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng
 *     responses:
 *       200:
 *         description: Thông tin người dùng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 account:
 *                   type: object
 *                   description: Thông tin tài khoản
 *                 user:
 *                   type: object
 *                   description: Thông tin người dùng với organization, read_history, shared_documents, favorites
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Danh sách vai trò
 *       404:
 *         description: Người dùng không tồn tại
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.get("/:userId", requireLoggedIn, userController.getUserById);

/**
 * @swagger
 * /users/{userId}/follow:
 *   post:
 *     summary: Theo dõi một người dùng khác
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng cần theo dõi
 *     responses:
 *       200:
 *         description: Theo dõi thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
router.post("/:userId/follow", requireLoggedIn, userController.followUser);

/**
 * @swagger
 * /users/{userId}/unfollow:
 *   post:
 *     summary: Bỏ theo dõi một người dùng khác
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng cần bỏ theo dõi
 *     responses:
 *       200:
 *         description: Bỏ theo dõi thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
router.post("/:userId/unfollow", requireLoggedIn, userController.unfollowUser);

/**
 * @swagger
 * /users/{userId}/roles:
 *   get:
 *     summary: Lấy danh sách quyền hạn của một người dùng theo ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng
 *     responses:
 *       200:
 *         description: Danh sách quyền hạn của người dùng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Danh sách quyền hạn
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                   description: Danh sách vai trò với quyền hạn
 *       404:
 *         description: Người dùng không tồn tại
 *       400:
 *         description: Yêu cầu không hợp lệ
 */
router.get(
  "/:userId/roles",
  requireLoggedIn,
  userController.getUserPermissions
);

module.exports = router;
