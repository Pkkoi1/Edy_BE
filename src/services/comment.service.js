const Comment = require("../models/comment.model");
const Document = require("../models/document.model");
const User = require("../models/user.model");
const { canViewDocument } = require("./document.service");
const {
  notifyNewComment,
  notifyCommentReply,
} = require("./notification.service");
const { incrementCommentCount } = require("./user_statistics.service");
const { earnPoints } = require("./point_transaction.service");
const Reaction = require("../models/reaction.model");
const PointTransaction = require("../models/point_transaction.model");
const mongoose = require("mongoose");

// Tạo bình luận mới
const createComment = async (userId, documentId, content, parentId = null) => {
  // Kiểm tra tài liệu tồn tại
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error("Tài liệu không tồn tại");
  }

  // Kiểm tra quyền truy cập tài liệu
  const hasAccess = await canViewDocument(userId, documentId);
  if (!hasAccess) {
    throw new Error("Bạn không có quyền bình luận về tài liệu này");
  }

  // Kiểm tra parent comment nếu có
  if (parentId) {
    const parentComment = await Comment.findById(parentId);
    if (!parentComment) {
      throw new Error("Bình luận gốc không tồn tại");
    }
    if (parentComment.doc.toString() !== documentId) {
      throw new Error("Bình luận gốc không thuộc về tài liệu này");
    }
  }

  // Tạo bình luận
  const comment = new Comment({
    doc: documentId,
    user: userId,
    content: content.trim(),
    parent: parentId,
  });

  await comment.save();

  // Cập nhật comment_count của document
  await Document.findByIdAndUpdate(documentId, { $inc: { comment_count: 1 } });

  // Cập nhật thống kê user
  try {
    await incrementCommentCount(userId);
  } catch (statsError) {
    console.error("Lỗi cập nhật thống kê comment:", statsError);
  }

  // Populate thông tin user
  await comment.populate({
    path: "user",
    select: "_id first_name last_name avatar",
  });

  // Kiểm tra xem user đã reaction trên document này chưa
  // Nếu có thì cộng thêm 1 điểm bonus cho việc comment + reaction
  try {
    const existingReaction = await Reaction.findOne({
      doc: documentId,
      user: userId,
    });

    if (existingReaction) {
      // Kiểm tra xem user đã nhận bonus points cho document này chưa
      const existingBonusTransaction = await PointTransaction.findOne({
        user: userId,
        type: "EARN",
        reason: { $regex: "Thưởng comment và đánh giá tài liệu" },
        doc: documentId,
      });

      if (!existingBonusTransaction) {
        // User đã reaction và vừa comment → cộng 1 điểm bonus
        await earnPoints(
          userId,
          1,
          `Thưởng comment và đánh giá tài liệu ${document.title}`,
          documentId
        );

        // Tạo notification cho điểm bonus
        const { notifyPointsEarned } = require("./notification.service");
        await notifyPointsEarned(
          userId,
          1,
          `Thưởng comment và đánh giá tài liệu ${document.title}`
        );
      }
    }
  } catch (bonusError) {
    console.error(
      "Error creating bonus points for comment + reaction:",
      bonusError
    );
    // Không làm fail việc tạo comment nếu cộng điểm bonus thất bại
  }

  // Gửi thông báo cho chủ sở hữu tài liệu hoặc người được reply
  // try {
  //   const user = await User.findById(userId);
  //   const commenterName = `${user.first_name} ${user.last_name}`;

  //   if (parentId) {
  //     // Đây là reply - thông báo cho người được reply
  //     const parentComment = await Comment.findById(parentId);
  //     if (parentComment && parentComment.user.toString() !== userId) {
  //       await notifyCommentReply(
  //         parentComment.user.toString(),
  //         comment._id,
  //         commenterName
  //       );
  //     }
  //   } else {
  //     // Đây là comment chính - thông báo cho chủ sở hữu tài liệu
  //     if (document.user.toString() !== userId) {
  //       await notifyNewComment(
  //         document.user.toString(),
  //         comment._id,
  //         commenterName
  //       );
  //     }
  //   }
  // } catch (notificationError) {
  //   // Log lỗi nhưng không làm fail việc tạo comment
  //   console.error("Lỗi gửi thông báo comment:", notificationError);
  // }

  return comment;
};

// Lấy danh sách bình luận theo tài liệu
const getCommentsByDocument = async (documentId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  // Kiểm tra tài liệu tồn tại
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error("Tài liệu không tồn tại");
  }

  // Lấy comments chính (không có parent)
  const [comments, total] = await Promise.all([
    Comment.find({ doc: documentId, parent: null })
      .populate({
        path: "user",
        select: "_id first_name last_name avatar",
        populate: {
          path: "organization",
          select: "_id name",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Comment.countDocuments({ doc: documentId, parent: null }),
  ]);

  // Lấy replies cho mỗi comment chính
  const commentsWithReplies = await Promise.all(
    comments.map(async (comment) => {
      const replies = await Comment.find({ parent: comment._id })
        .populate({
          path: "user",
          select: "_id first_name last_name avatar",
          populate: {
            path: "organization",
            select: "_id name",
          },
        })
        .sort({ createdAt: 1 })
        .limit(5); // Giới hạn 5 replies đầu tiên

      const replyCount = await Comment.countDocuments({ parent: comment._id });

      return {
        ...comment.toObject(),
        replies,
        reply_count: replyCount,
      };
    })
  );

  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;

  return {
    comments: commentsWithReplies,
    total,
    page,
    totalPages,
    have_next,
  };
};

// Lấy replies cho một comment
const getRepliesByComment = async (commentId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  // Kiểm tra comment gốc tồn tại
  const parentComment = await Comment.findById(commentId);
  if (!parentComment) {
    throw new Error("Bình luận không tồn tại");
  }

  const [replies, total] = await Promise.all([
    Comment.find({ parent: commentId })
      .populate({
        path: "user",
        select: "_id first_name last_name avatar",
        populate: {
          path: "organization",
          select: "_id name",
        },
      })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit),
    Comment.countDocuments({ parent: commentId }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;

  return {
    replies,
    total,
    page,
    totalPages,
    have_next,
    parent_comment: parentComment,
  };
};

// Cập nhật bình luận
const updateComment = async (commentId, userId, content) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new Error("Bình luận không tồn tại");
  }

  // Kiểm tra quyền sở hữu
  if (comment.user.toString() !== userId) {
    throw new Error("Bạn không có quyền chỉnh sửa bình luận này");
  }

  comment.content = content.trim();
  await comment.save();

  // Populate thông tin user
  await comment.populate({
    path: "user",
    select: "_id first_name last_name avatar",
  });

  return comment;
};

// Xóa bình luận
const deleteComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new Error("Bình luận không tồn tại");
  }

  // Kiểm tra quyền sở hữu
  if (comment.user.toString() !== userId) {
    throw new Error("Bạn không có quyền xóa bình luận này");
  }

  // Đếm số replies
  const replyCount = await Comment.countDocuments({ parent: commentId });
  let totalDeleted = 1 + replyCount;

  // Xóa tất cả replies trước
  await Comment.deleteMany({ parent: commentId });

  // Xóa comment chính
  await Comment.findByIdAndDelete(commentId);

  // Cập nhật comment_count của document
  await Document.findByIdAndUpdate(comment.doc, {
    $inc: { comment_count: -totalDeleted },
  });

  return { message: "Xóa bình luận thành công", deleted_count: totalDeleted };
};

// Lấy thống kê bình luận theo tài liệu
const getCommentStats = async (documentId) => {
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error("Tài liệu không tồn tại");
  }

  const [totalComments, mainComments, replies] = await Promise.all([
    Comment.countDocuments({ doc: documentId }),
    Comment.countDocuments({ doc: documentId, parent: null }),
    Comment.countDocuments({ doc: documentId, parent: { $ne: null } }),
  ]);

  return {
    document_id: documentId,
    total_comments: totalComments,
    main_comments: mainComments,
    replies: replies,
    document_comment_count: document.comment_count || 0,
  };
};

module.exports = {
  createComment,
  getCommentsByDocument,
  getRepliesByComment,
  updateComment,
  deleteComment,
  getCommentStats,
};
