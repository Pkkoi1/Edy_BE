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
 * /users/contributions:
 *   get:
 *     summary: Lấy thành tích đóng góp của người dùng hiện tại
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         description: "Năm để lọc dữ liệu (tùy chọn). Nếu không cung cấp sẽ lấy tất cả thời gian"
 *         example: 2024
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
 *                 year:
 *                   type: integer
 *                   nullable: true
 *                   description: Năm được lọc (null nếu không lọc)
 *                   example: 2024
 *                 contributions:
 *                   type: object
 *                   properties:
 *                     total_documents:
 *                       type: integer
 *                       description: Tổng số bài đăng (documents)
 *                       example: 15
 *                     total_reactions:
 *                       type: integer
 *                       description: Tổng số lần tương tác tài liệu (like/dislike)
 *                       example: 45
 *                     total_downloads:
 *                       type: integer
 *                       description: Tổng số lần tải tài liệu thành công
 *                       example: 23
 *                     total_comments:
 *                       type: integer
 *                       description: Tổng số bình luận
 *                       example: 67
 *       400:
 *         description: Năm không hợp lệ hoặc lỗi khác
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Người dùng không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/contributions",
  requireLoggedIn,
  userController.getUserContributions
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

/**
 * @swagger
 * /users/{userId}/status:
 *   put:
 *     summary: Cập nhật trạng thái tài khoản của người dùng (yêu cầu quyền quản lý người dùng)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, BANNED]
 *                 example: "ACTIVE"
 *                 description: "Trạng thái mới của tài khoản"
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cập nhật trạng thái người dùng thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: ID của người dùng
 *                     oldStatus:
 *                       type: string
 *                       enum: [ACTIVE, INACTIVE, BANNED]
 *                       description: Trạng thái cũ
 *                     newStatus:
 *                       type: string
 *                       enum: [ACTIVE, INACTIVE, BANNED]
 *                       description: Trạng thái mới
 *                     updatedBy:
 *                       type: string
 *                       description: ID của người thực hiện cập nhật
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Thời gian cập nhật
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc trạng thái không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền quản lý người dùng
 *       404:
 *         description: Người dùng không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.put(
  "/:userId/status",
  requireAdminPermission(["MANAGE_USER"]),
  userController.updateUserStatus
);

/**
 * @swagger
 * /users/{userId}/restrictions:
 *   get:
 *     summary: Lấy lịch sử bị phạt của người dùng
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng
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
 *                 restrictions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: ID của penalty
 *                       user_id:
 *                         type: string
 *                         description: ID của người dùng bị phạt
 *                       type:
 *                         type: string
 *                         enum: [POST, COMMENT, DOWNLOAD, LOGIN]
 *                         description: Loại phạt
 *                       reason:
 *                         type: string
 *                         description: Lý do phạt
 *                       startAt:
 *                         type: string
 *                         format: date-time
 *                         description: Thời gian bắt đầu
 *                       endAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: Thời gian kết thúc (null = vĩnh viễn)
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, DEACTIVATED, EXPIRED]
 *                         description: Trạng thái
 *                       restricted_by:
 *                         type: string
 *                         description: Người áp dụng phạt
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Thời gian tạo
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       404:
 *         description: Người dùng không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/:userId/restrictions",
  requireLoggedIn,
  userController.getUserRestrictions
);

/**
 * @swagger
 * /users/{userId}/violations:
 *   get:
 *     summary: Lấy lịch sử vi phạm của người dùng
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng
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
 *                 violations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: ID của violation
 *                       user_id:
 *                         type: string
 *                         description: ID của người dùng vi phạm
 *                       document:
 *                         type: object
 *                         nullable: true
 *                         description: Thông tin tài liệu vi phạm
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: ID tài liệu
 *                           title:
 *                             type: string
 *                             description: Tiêu đề tài liệu
 *                       comment:
 *                         type: object
 *                         nullable: true
 *                         description: Thông tin bình luận vi phạm
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: ID bình luận
 *                           content:
 *                             type: string
 *                             description: Nội dung bình luận
 *                       type:
 *                         type: array
 *                         items:
 *                           type: string
 *                           enum: [SPAM_OR_MISLEADING, DUPLICATE, COPYRIGHT, INCORRECT_CATEGORY, PERSONAL_INFORMATION, LOW_QUALITY, INAPPROPRIATE, OTHER]
 *                         description: Loại vi phạm
 *                       report:
 *                         type: object
 *                         nullable: true
 *                         description: Thông tin báo cáo
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: ID báo cáo
 *                           reason:
 *                             type: string
 *                             description: Lý do báo cáo
 *                       strike:
 *                         type: integer
 *                         description: Số strike
 *                       point_reduced:
 *                         type: integer
 *                         description: Điểm bị trừ
 *                       resolved_by:
 *                         type: string
 *                         description: Người xử lý
 *                       reason:
 *                         type: string
 *                         description: Lý do xử lý
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Thời gian tạo
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       404:
 *         description: Người dùng không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/:userId/violations",
  requireLoggedIn,
  userController.getUserViolations
);

/**
 * @swagger
 * /users/{userId}/suspend:
 *   post:
 *     summary: Khóa tài khoản người dùng (yêu cầu quyền quản lý người dùng)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng cần khóa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Vi phạm quy định cộng đồng"
 *                 description: "Lý do khóa tài khoản"
 *               duration_days:
 *                 type: integer
 *                 minimum: 1
 *                 example: 7
 *                 description: "Thời hạn khóa (ngày). Nếu không cung cấp sẽ khóa vĩnh viễn"
 *     responses:
 *       200:
 *         description: Khóa tài khoản thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Khóa tài khoản thành công"
 *                 restriction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID của restriction
 *                     type:
 *                       type: string
 *                       example: "LOGIN"
 *                     reason:
 *                       type: string
 *                       description: Lý do khóa
 *                     startAt:
 *                       type: string
 *                       format: date-time
 *                       description: Thời gian bắt đầu khóa
 *                     endAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Thời gian kết thúc khóa
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc tài khoản đã bị khóa
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền quản lý người dùng
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/:userId/suspend",
  requireAdminPermission(["MANAGE_USER"]),
  userController.suspendUser
);

/**
 * @swagger
 * /users/{userId}/unsuspend:
 *   post:
 *     summary: Mở khóa tài khoản người dùng (yêu cầu quyền quản lý người dùng)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người dùng cần mở khóa
 *     responses:
 *       200:
 *         description: Mở khóa tài khoản thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Mở khóa tài khoản thành công"
 *                 restriction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID của restriction
 *                     type:
 *                       type: string
 *                       example: "LOGIN"
 *                     reason:
 *                       type: string
 *                       description: Lý do khóa
 *                     startAt:
 *                       type: string
 *                       format: date-time
 *                       description: Thời gian bắt đầu khóa
 *                     endAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Thời gian kết thúc khóa
 *                     status:
 *                       type: string
 *                       example: "DEACTIVATED"
 *       400:
 *         description: Tài khoản không bị khóa
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền quản lý người dùng
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/:userId/unsuspend",
  requireAdminPermission(["MANAGE_USER"]),
  userController.unsuspendUser
);

module.exports = router;
