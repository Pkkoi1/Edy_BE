const {
  createComment,
  getCommentsByDocument,
  getRepliesByComment,
  updateComment,
  deleteComment,
  getCommentStats,
} = require("../services/comment.service");

// Tạo bình luận mới
exports.createComment = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        message: "Nội dung bình luận không được để trống",
      });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({
        message: "Nội dung bình luận không được vượt quá 1000 ký tự",
      });
    }

    const comment = await createComment(userId, documentId, content, parentId);

    res.status(201).json({
      message: "Tạo bình luận thành công",
      comment,
      status: 201,
    });
  } catch (error) {
    console.error("Lỗi tạo bình luận:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi tạo bình luận: " + error.message,
    });
  }
};

// Lấy danh sách bình luận theo tài liệu
exports.getCommentsByDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await getCommentsByDocument(
      documentId,
      parseInt(page),
      parseInt(limit)
    );

    res.json(result);
  } catch (error) {
    console.error("Lỗi lấy danh sách bình luận:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy danh sách bình luận: " + error.message,
    });
  }
};

// Lấy replies cho một comment
exports.getRepliesByComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await getRepliesByComment(
      commentId,
      parseInt(page),
      parseInt(limit)
    );

    res.json(result);
  } catch (error) {
    console.error("Lỗi lấy replies:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy replies: " + error.message,
    });
  }
};

// Cập nhật bình luận
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        message: "Nội dung bình luận không được để trống",
      });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({
        message: "Nội dung bình luận không được vượt quá 1000 ký tự",
      });
    }

    const comment = await updateComment(commentId, userId, content);

    res.json({
      message: "Cập nhật bình luận thành công",
      comment,
    });
  } catch (error) {
    console.error("Lỗi cập nhật bình luận:", error);

    if (
      error.message.includes("không có quyền") ||
      error.message.includes("không tồn tại")
    ) {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi cập nhật bình luận: " + error.message,
    });
  }
};

// Xóa bình luận
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const result = await deleteComment(commentId, userId);

    res.json(result);
  } catch (error) {
    console.error("Lỗi xóa bình luận:", error);

    if (
      error.message.includes("không có quyền") ||
      error.message.includes("không tồn tại")
    ) {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi xóa bình luận: " + error.message,
    });
  }
};

// Lấy thống kê bình luận
exports.getCommentStats = async (req, res) => {
  try {
    const { documentId } = req.params;

    const stats = await getCommentStats(documentId);

    res.json(stats);
  } catch (error) {
    console.error("Lỗi lấy thống kê bình luận:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy thống kê bình luận: " + error.message,
    });
  }
};
