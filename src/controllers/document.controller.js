const axios = require("axios");
const mongoose = require("mongoose");
const {
  getNewestDocuments,
  createDocument,
  getDocumentById,
  getMyDocuments,
  getPendingDocuments,
  getDocumentsBySubject,
  processDownload,
  createDownloadLink,
  markDownloadSuccess,
  updateDocument,
  changeAllShareLink,
  getAllDocuments,
  getSimilarDocuments,
  reactionDocument,
  getDocumentReactions,
  addToHistory,
  getReadHistory,
  getDocumentsByUserId,
  incrementViewCount,
} = require("../services/document.service");
const { getOrganizationById } = require("../services/organization.service");
const {
  createApprovalRequest,
  getPendingRequestsByDocument,
  approveRequest,
  rejectRequest,
} = require("../services/approval_request.service");

const { checkIsFavorite } = require("../services/user.service");

exports.getAllDocuments = async (req, res) => {
  try {
    const { search, ordering, order, page, limit, ...filters } = req.query;

    const result = await getAllDocuments({
      payload: req.user,
      search,
      ordering,
      order: parseInt(order) || -1,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 5,
      ...filters,
    });

    res.json(result);
  } catch (error) {
    console.error("Đã:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi: " + error.message,
    });
  }
};

exports.getNewestDocuments = async (req, res) => {
  try {
    const {
      search,
      ordering = "last_approved_at",
      order = -1,
      page = 1,
      limit = 5,
      ...filters
    } = req.query;

    const result = await getNewestDocuments({
      payload: req.user,
      search,
      ordering,
      order,
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy tài liệu: " + error.message });
  }
};

exports.getDocumentsBySubject = async (req, res) => {
  try {
    const {
      search,
      ordering = "createdAt",
      order = -1,
      page = 1,
      limit = 5,
      ...filters
    } = req.query;

    const subjectId = req.params.id;

    // Validation ngay tại controller
    if (!subjectId) {
      return res.status(400).json({ message: "Subject ID là bắt buộc" });
    }

    // Kiểm tra format ObjectId
    if (!subjectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ message: "Subject ID không đúng định dạng" });
    }

    const result = await getDocumentsBySubject({
      subject: subjectId,
      payload: req.user,
      search,
      ordering,
      order,
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters,
    });
    res.json(result);
  } catch (error) {
    // Xử lý các loại lỗi khác nhau
    if (error.message === "Môn học không hợp lệ") {
      return res
        .status(404)
        .json({ message: "Môn học không tồn tại hoặc đã bị xóa" });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy tài liệu: " + error.message,
    });
  }
};

exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await getDocumentById(
      id,
      req.user ? req.user.userId : null
    );

    if (!document) {
      return res.status(404).json({
        message: "Tài liệu không tồn tại hoặc bạn không có quyền truy cập",
      });
    }

    // Kiểm tra xem tài liệu có trong danh sách yêu thích của người dùng không (nếu user đã đăng nhập)
    if (req.user && req.user.userId) {
      const isFavorite = await checkIsFavorite(req.user.userId, document._id);
      document.is_favorite = isFavorite;

      //thêm tài liệu vào lịch sử truy cập
      await addToHistory(req.user.userId, document._id);
    } else {
      document.is_favorite = false;
    }

    res.json(document);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy tài liệu: " + error.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    // nhận thông tin tài liệu (url là link cloudinary)
    const {
      url,
      preview_url,
      title,
      doc_type,
      file_type,
      cover_page,
      subject,
      author,
      published_year,
      publisher,
      organization,
      level,
      intensive,
      keyword,
      public_mode,
      description,
      page,
    } = req.body;

    let descriptionObj = {
      summary_by_user: null,
      summary_by_ai: null,
    };
    if (description && description.length > 10) {
      descriptionObj.summary_by_user = description;
    }

    const document = await createDocument({
      user: req.user.userId, // người đăng
      url,
      preview_url,
      title,
      doc_type,
      file_type,
      cover_page,
      subject,
      author,
      published_year,
      publisher,
      organization,
      level,
      intensive,
      keyword,
      public_mode,
      description: descriptionObj,
      page,
      summary_status: descriptionObj.summary_by_user ? "PENDING" : "NONE",
    });

    //Tạo approval request (tạo trc vì nó cũng quan trọng và nhanh)
    await createApprovalRequest(document._id, req.user.userId);

    res.status(201).json({
      message: "Tải lên tài liệu thành công",
      document,
      status: 201,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: error.message || "Đã xảy ra lỗi khi tải lên tài liệu" });
  }
};

exports.getMyDocuments = async (req, res) => {
  try {
    const {
      search,
      ordering = "createdAt",
      order = -1,
      page = 1,
      limit = 5,
      ...filters
    } = req.query;

    const result = await getMyDocuments({
      payload: req.user,
      search,
      ordering,
      order,
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy tài liệu chờ duyệt" });
  }
};

// Download
exports.createDownloadLink = async (req, res) => {
  try {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(400).json({ message: "documentId là bắt buộc" });
    }
    const userId = req.user.userId;
    const result = await createDownloadLink(userId, documentId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi tạo link download: " + error.message,
    });
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const { linkId } = req.params;
    if (!linkId) {
      return res.status(400).json({ message: "linkId là bắt buộc" });
    }
    const userId = req.user.userId;
    const result = await processDownload(linkId, userId);
    if (result.error) {
      return res.status(result.status || 400).json({ message: result.message });
    }
    const response = await axios.get(result.downloadUrl, {
      responseType: "stream",
    });
    const filename = result.filename || "download";
    const safeFilename = encodeURIComponent(filename)
      .replace(/['()]/g, escape)
      .replace(/\*/g, "%2A");

    const contentType =
      result.contentType ||
      response.headers["content-type"] ||
      "application/octet-stream";

    // Set headers theo chuẩn RFC 6266
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="download"; filename*=UTF-8''${safeFilename}`
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Filename", encodeURIComponent(filename)); // Custom header cho filename
    res.setHeader(
      "X-Original-Title",
      encodeURIComponent(result.document?.title || filename)
    ); // Title gốc
    response.data.pipe(res);

    res.on("finish", () => {
      markDownloadSuccess(linkId);
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi xử lý download: " + error.message });
  }
};

// Admin
exports.getPendingDocuments = async (req, res) => {
  try {
    const {
      search,
      ordering = "createdAt",
      order = -1,
      page = 1,
      limit = 5,
      ...filters
    } = req.query;

    const result = await getPendingDocuments({
      payload: req.user,
      search,
      ordering,
      order,
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy tài liệu chờ duyệt" });
  }
};

exports.getPendingRequestsByDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const requests = await getPendingRequestsByDocument(documentId);
    res.json({ requests });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy yêu cầu phê duyệt" });
  }
};

exports.approveDocument = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { isIntensive = false } = req.body || {};
    const reviewerId = req.user.userId;

    const approvalRequest = await approveRequest(
      requestId,
      reviewerId,
      isIntensive
    );
    if (!approvalRequest) {
      return res
        .status(404)
        .json({ message: "Yêu cầu phê duyệt không tồn tại" });
    }
    res.json({ message: "Phê duyệt tài liệu thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi phê duyệt tài liệu" });
  }
};

exports.rejectDocument = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message = "" } = req.body;
    const reviewerId = req.user.userId;

    const approvalRequest = await rejectRequest(requestId, reviewerId, message);
    if (!approvalRequest) {
      return res
        .status(404)
        .json({ message: "Yêu cầu phê duyệt không tồn tại" });
    }
    res.json({ message: "Từ chối tài liệu thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi từ chối tài liệu" });
  }
};

exports.updateDocumentPublicMode = async (req, res) => {
  try {
    const { id } = req.params;
    const { public_mode } = req.body;

    if (!public_mode) {
      return res.status(400).json({ message: "public_mode là bắt buộc" });
    }

    const allowedModes = ["PUBLIC", "PRIVATE", "SHARE_ORGANIZATION"];
    if (!allowedModes.includes(public_mode)) {
      return res.status(400).json({
        message: `public_mode phải là một trong: ${allowedModes.join(", ")}`,
      });
    }

    // Kiểm tra quyền sở hữu tài liệu
    const document = await getDocumentById(id, req.user.userId);
    if (!document) {
      return res.status(404).json({
        message: "Tài liệu không tồn tại hoặc bạn không có quyền truy cập",
      });
    }

    if (document.user._id.toString() !== req.user.userId) {
      return res.status(403).json({
        message:
          "Chỉ chủ sở hữu mới có thể thay đổi chế độ công khai của tài liệu",
      });
    }

    // Cập nhật public_mode
    const updatedDocument = await updateDocument(id, { public_mode });

    if (public_mode === "SHARE_ORGANIZATION" || public_mode === "PUBLIC") {
      changeAllShareLink(req.user.userId, id, "INACTIVE");
    }

    res.json({
      message: "Cập nhật chế độ công khai thành công",
      document: {
        _id: updatedDocument._id,
        title: updatedDocument.title,
        public_mode: updatedDocument.public_mode,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi cập nhật chế độ công khai: " + error.message,
    });
  }
};

exports.updateDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "status là bắt buộc" });
    }

    const allowedStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "REQUESTED_EDIT",
      "PENDING_EDIT",
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `status phải là một trong: ${allowedStatuses.join(", ")}`,
      });
    }

    // Kiểm tra tài liệu tồn tại
    const document = await getDocumentById(id, req.user.userId);
    if (!document) {
      return res.status(404).json({
        message: "Tài liệu không tồn tại hoặc bạn không có quyền truy cập",
      });
    }

    // Cập nhật status và last_approved_at nếu status là APPROVED
    const updateData = { status };
    if (status === "APPROVED") {
      updateData.last_approved_at = new Date();
    }

    const updatedDocument = await updateDocument(id, updateData);

    res.json({
      message: "Cập nhật trạng thái tài liệu thành công",
      document: {
        _id: updatedDocument._id,
        title: updatedDocument.title,
        status: updatedDocument.status,
        last_approved_at: updatedDocument.last_approved_at,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Đã xảy ra lỗi khi cập nhật trạng thái tài liệu: " + error.message,
    });
  }
};

exports.updateDocumentInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cover_page,
      title,
      subject,
      organization,
      doc_type,
      page,
      level,
      description,
      publisher,
      published_year,
      author,
      keyword,
    } = req.body;

    // Kiểm tra quyền sở hữu tài liệu
    const document = await getDocumentById(id, req.user.userId);
    if (!document) {
      return res.status(404).json({
        message: "Tài liệu không tồn tại hoặc bạn không có quyền truy cập",
      });
    }

    if (document.user._id.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "Chỉ chủ sở hữu mới có thể chỉnh sửa thông tin tài liệu",
      });
    }

    // Tạo object chứa các trường cần cập nhật (chỉ những trường có giá trị)
    const updateData = {};

    if (cover_page !== undefined) updateData.cover_page = cover_page;
    if (title !== undefined) updateData.title = title;
    if (subject !== undefined) updateData.subject = subject;
    if (organization !== undefined) updateData.organization = organization;
    if (doc_type !== undefined) updateData.doc_type = doc_type;
    if (page !== undefined) updateData.page = page;
    if (level !== undefined) updateData.level = level;
    if (publisher !== undefined) updateData.publisher = publisher;
    if (published_year !== undefined)
      updateData.published_year = published_year;
    if (author !== undefined) updateData.author = author;
    if (keyword !== undefined) updateData.keyword = keyword;

    // Xử lý description (tóm tắt do người dùng)
    if (description !== undefined) {
      updateData.description = {
        ...document.description,
        summary_by_user: description,
      };
      // Nếu có tóm tắt mới, đặt summary_status về PENDING
      if (description && description.length > 10) {
        updateData.summary_status = "PENDING";
      }
    }

    // Validation cho các trường enum
    if (doc_type) {
      const allowedDocTypes = [
        "RESEARCH_REPORT",
        "VIDEO",
        "STUDY_GUIDE",
        "TEXTBOOK",
        "ESSAY",
        "SOLUTION_SET",
        "THESIS",
        "LECTURE",
        "OTHER",
      ];
      if (!allowedDocTypes.includes(doc_type)) {
        return res.status(400).json({
          message: `doc_type phải là một trong: ${allowedDocTypes.join(", ")}`,
        });
      }
    }

    if (level) {
      const allowedLevels = [
        "STUDENT",
        "UNIVERSITY",
        "LECTURER",
        "RESEARCHER",
        "OTHER",
      ];
      if (!allowedLevels.includes(level)) {
        return res.status(400).json({
          message: `level phải là một trong: ${allowedLevels.join(", ")}`,
        });
      }
    }

    // Validation cho ObjectId fields
    if (subject) {
      if (!subject.match(/^[0-9a-fA-F]{24}$/)) {
        return res
          .status(400)
          .json({ message: "Subject ID không đúng định dạng" });
      }
    }

    if (organization) {
      if (!organization.match(/^[0-9a-fA-F]{24}$/)) {
        return res
          .status(400)
          .json({ message: "Organization ID không đúng định dạng" });
      }
    }

    // Kiểm tra có ít nhất một trường để cập nhật
    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ message: "Không có thông tin nào để cập nhật" });
    }

    // Cập nhật tài liệu
    const updatedDocument = await updateDocument(id, updateData);

    res.json({
      message: "Cập nhật thông tin tài liệu thành công",
      document: {
        _id: updatedDocument._id,
        title: updatedDocument.title,
        cover_page: updatedDocument.cover_page,
        subject: updatedDocument.subject,
        organization: updatedDocument.organization,
        doc_type: updatedDocument.doc_type,
        page: updatedDocument.page,
        level: updatedDocument.level,
        description: updatedDocument.description,
        publisher: updatedDocument.publisher,
        published_year: updatedDocument.published_year,
        author: updatedDocument.author,
        keyword: updatedDocument.keyword,
        summary_status: updatedDocument.summary_status,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Đã xảy ra lỗi khi cập nhật thông tin tài liệu: " + error.message,
    });
  }
};

exports.getSimilarDocuments = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.userId;
    const { limit = 5 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ message: "ID tài liệu không hợp lệ" });
    }

    const result = await getSimilarDocuments(
      documentId,
      userId,
      parseInt(limit)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: error.message || "Lỗi server khi lấy tài liệu tương tự",
    });
  }
};

exports.reactionDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { reaction } = req.body;
    const userId = req.user?.userId;
    if (!["LIKE", "DISLIKE", "UNREACT"].includes(reaction)) {
      return res.status(400).json({ message: "Loại tương tác không hợp lệ" });
    }

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ message: "ID tài liệu không hợp lệ" });
    }
    const result = await reactionDocument(documentId, userId, reaction);
    if (result.error || !result) {
      return res
        .status(result.status || 400)
        .json({ message: result.message } || "Lỗi khi thực hiện tương tác");
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: error.message || "Lỗi server khi thực hiện tương tác",
    });
  }
};

exports.getDocumentReactions = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.userId;
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ message: "ID tài liệu không hợp lệ" });
    }
    const result = await getDocumentReactions(documentId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: error.message || "Lỗi server khi lấy thông tin tương tác",
    });
  }
};

exports.getReadHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const result = await getReadHistory(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: error.message || "Lỗi server khi lấy lịch sử đọc",
    });
  }
};

exports.getDocumentsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      search,
      ordering = "createdAt",
      order = -1,
      page = 1,
      limit = 5,
      ...filters
    } = req.query;

    // Validation userId
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "ID người dùng không hợp lệ",
      });
    }

    const result = await getDocumentsByUserId({
      userId,
      payload: req.user,
      search,
      ordering,
      order: parseInt(order),
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters,
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy tài liệu: " + error.message,
    });
  }
};

exports.incrementView = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.userId;

    if (!documentId) {
      return res.status(400).json({ message: "documentId là bắt buộc" });
    }

    if (!documentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ message: "documentId không đúng định dạng" });
    }

    const result = await incrementViewCount(documentId, userId);

    if (result.error) {
      return res.status(result.status || 400).json({ message: result.message });
    }

    res.json({
      message: "Tăng số lượt xem thành công",
      view_count: result.newViewCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi tăng số lượt xem: " + error.message,
    });
  }
};
