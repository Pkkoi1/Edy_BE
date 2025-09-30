const axios = require("axios");
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
} = require("../services/document.service");
const { getOrganizationById } = require("../services/organization.service");
const {
  createApprovalRequest,
  getPendingRequestsByDocument,
  approveRequest,
  rejectRequest,
} = require("../services/approval_request.service");

const { checkIsFavorite } = require("../services/user.service");

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
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy tài liệu" });
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

    const result = await getDocumentsBySubject({
      subject: req.params.subjectId,
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
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy tài liệu" });
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

    const allowedModes = [
      "PUBLIC",
      "PRIVATE",
      "PRIVATE_SHARED",
      "SHARE_ORGANIZATION",
    ];
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
