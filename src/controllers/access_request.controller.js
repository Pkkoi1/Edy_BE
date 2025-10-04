const {
  createAccessRequest,
  getAccessRequestsByPrivateShare,
  approveAccessRequest,
  denyAccessRequest,
  getMyAccessRequests,
} = require("../services/access_request.service");

/**
 * Tạo yêu cầu truy cập tài liệu qua private share
 */
exports.createAccessRequest = async (req, res) => {
  try {
    const { privateShareId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!privateShareId) {
      return res.status(400).json({ message: "Private share ID là bắt buộc" });
    }

    const accessRequest = await createAccessRequest(
      privateShareId,
      userId,
      content
    );

    res.status(201).json({
      message: "Gửi yêu cầu truy cập thành công",
      accessRequest,
    });
  } catch (error) {
    console.error("Có lỗi xảy ra khi tạo yêu cầu truy cập:", error);

    // Xử lý các lỗi cụ thể
    if (
      error.message.includes("không tồn tại") ||
      error.message.includes("đã hết thời gian") ||
      error.message.includes("đã đạt giới hạn") ||
      error.message.includes("đã có quyền truy cập") ||
      error.message.includes("đã gửi yêu cầu") ||
      error.message.includes("không thể gửi yêu cầu")
    ) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi tạo yêu cầu truy cập: " + error.message,
    });
  }
};

/**
 * Lấy danh sách yêu cầu truy cập theo private share (chỉ chủ sở hữu)
 */
exports.getAccessRequestsByPrivateShare = async (req, res) => {
  try {
    const { privateShareId } = req.params;
    const {
      status,
      page = 1,
      limit = 10,
      ordering = "createdAt",
      order = -1,
    } = req.query;

    if (!privateShareId) {
      return res.status(400).json({ message: "Private share ID là bắt buộc" });
    }

    const ownerId = req.user.userId;
    const result = await getAccessRequestsByPrivateShare(
      privateShareId,
      ownerId,
      {
        status,
        page: parseInt(page),
        limit: parseInt(limit),
        ordering,
        order: parseInt(order),
      }
    );

    res.json(result);
  } catch (error) {
    console.error("Có lỗi xảy ra khi lấy danh sách yêu cầu truy cập:", error);

    if (
      error.message.includes("không tồn tại") ||
      error.message.includes("không có quyền")
    ) {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({
      message:
        "Đã xảy ra lỗi khi lấy danh sách yêu cầu truy cập: " + error.message,
    });
  }
};

/**
 * Phê duyệt yêu cầu truy cập
 */
exports.approveAccessRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ownerId = req.user.userId;

    if (!requestId) {
      return res.status(400).json({ message: "Request ID là bắt buộc" });
    }

    const accessRequest = await approveAccessRequest(requestId, ownerId);

    res.json({
      message: "Phê duyệt yêu cầu truy cập thành công",
      accessRequest: {
        _id: accessRequest._id,
        status: accessRequest.status,
        user: accessRequest.user,
        doc: accessRequest.doc,
        updatedAt: accessRequest.updatedAt,
      },
    });
  } catch (error) {
    console.error("Có lỗi xảy ra khi phê duyệt yêu cầu truy cập:", error);

    if (error.message.includes("không tồn tại")) {
      return res.status(404).json({ message: error.message });
    }

    if (
      error.message.includes("không có quyền") ||
      error.message.includes("đã được xử lý") ||
      error.message.includes("đã đạt giới hạn")
    ) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi phê duyệt yêu cầu truy cập: " + error.message,
    });
  }
};

/**
 * Từ chối yêu cầu truy cập
 */
exports.denyAccessRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ownerId = req.user.userId;

    if (!requestId) {
      return res.status(400).json({ message: "Request ID là bắt buộc" });
    }

    const accessRequest = await denyAccessRequest(requestId, ownerId);

    res.json({
      message: "Từ chối yêu cầu truy cập thành công",
      accessRequest: {
        _id: accessRequest._id,
        status: accessRequest.status,
        user: accessRequest.user,
        doc: accessRequest.doc,
        content: accessRequest.content,
        updatedAt: accessRequest.updatedAt,
      },
    });
  } catch (error) {
    console.error("Có lỗi xảy ra khi từ chối yêu cầu truy cập:", error);

    if (error.message.includes("không tồn tại")) {
      return res.status(404).json({ message: error.message });
    }

    if (
      error.message.includes("không có quyền") ||
      error.message.includes("đã được xử lý")
    ) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi từ chối yêu cầu truy cập: " + error.message,
    });
  }
};

/**
 * Lấy danh sách yêu cầu của người dùng hiện tại
 */
exports.getMyAccessRequests = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10,
      ordering = "createdAt",
      order = -1,
    } = req.query;

    const userId = req.user.userId;
    const result = await getMyAccessRequests(userId, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
      ordering,
      order: parseInt(order),
    });

    res.json(result);
  } catch (error) {
    console.error("Có lỗi xảy ra khi lấy danh sách yêu cầu truy cập của bạn:", error);

    res.status(500).json({
      message:
        "Đã xảy ra lỗi khi lấy danh sách yêu cầu truy cập của bạn: " +
        error.message,
    });
  }
};

/**
 * Xóa/hủy yêu cầu truy cập (chỉ người tạo yêu cầu)
 */
exports.cancelAccessRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    if (!requestId) {
      return res.status(400).json({ message: "Request ID là bắt buộc" });
    }

    const AccessRequest = require("../models/access_request.model");
    const accessRequest = await AccessRequest.findById(requestId);

    if (!accessRequest) {
      return res
        .status(404)
        .json({ message: "Yêu cầu truy cập không tồn tại" });
    }

    // Chỉ người tạo yêu cầu mới có thể hủy
    if (accessRequest.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền hủy yêu cầu này" });
    }

    // Chỉ có thể hủy yêu cầu đang PENDING
    if (accessRequest.status !== "PENDING") {
      return res
        .status(400)
        .json({ message: "Chỉ có thể hủy yêu cầu đang chờ xử lý" });
    }

    await AccessRequest.findByIdAndDelete(requestId);

    res.json({
      message: "Hủy yêu cầu truy cập thành công",
    });
  } catch (error) {
    console.error("Có lỗi xảy ra khi hủy yêu cầu truy cập:", error);

    res.status(500).json({
      message: "Đã xảy ra lỗi khi hủy yêu cầu truy cập: " + error.message,
    });
  }
};
