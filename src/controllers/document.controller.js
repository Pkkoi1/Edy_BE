const { getNewestDocuments, createDocument, getDocumentById, getMyDocuments, getPendingDocuments, getDocumentsBySubject } = require("../services/document.service");
const { getOrganizationById } = require("../services/organization.service");
const { createApprovalRequest, getPendingRequestsByDocument ,approveRequest, rejectRequest} = require("../services/approval_request.service");

exports.getNewestDocuments = async (req, res) => {
    try {
        const {
            search,
            ordering = 'createdAt',
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
            ...filters
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
            ordering = 'createdAt',
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
            ...filters
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
        const document = await getDocumentById(id, req.user);
        if (!document) {
            return res.status(404).json({ message: "Tài liệu không tồn tại hoặc bạn không có quyền truy cập" });
        }
        res.json(document);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi lấy tài liệu" });
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
            page
        } = req.body;

        let descriptionObj = {
            summary_by_user: null,
            summary_by_ai: null
        }
        if (description && description.length > 10) {
            descriptionObj.summary_by_user = description;
        }

        console.log(descriptionObj)

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
            page
        });

        //Tạo approval request (tạo trc vì nó cũng quan trọng và nhanh)
        await createApprovalRequest(document._id, req.user.userId);

        res.status(201).json({ message: "Tải lên tài liệu thành công", document });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Đã xảy ra lỗi khi tải lên tài liệu" });
    }
}

exports.getMyDocuments = async (req, res) => {
    try {
        const {
            search,
            ordering = 'createdAt',
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
            ...filters
        });
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi lấy tài liệu chờ duyệt" });
    }
}

// Admin
exports.getPendingDocuments = async (req, res) => {
    try {
        const {
            search,
            ordering = 'createdAt',
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
            ...filters
        });
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi lấy tài liệu chờ duyệt" });
    }
}

exports.getPendingRequestsByDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const requests = await getPendingRequestsByDocument(documentId);
        res.json({ requests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi lấy yêu cầu phê duyệt" });
    }
};

exports.approveDocument = async (req, res) => {
    try {
        const { requestId } = req.params;
        const reviewerId = req.user.userId;

        const approvalRequest = await approveRequest(requestId, reviewerId);
        if (!approvalRequest) {
            return res.status(404).json({ message: "Yêu cầu phê duyệt không tồn tại" });
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
        const { message } = req.body;
        const reviewerId = req.user.userId;

        const approvalRequest = await rejectRequest(requestId, reviewerId, message);
        if (!approvalRequest) {
            return res.status(404).json({ message: "Yêu cầu phê duyệt không tồn tại" });
        }
        res.json({ message: "Từ chối tài liệu thành công"});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi từ chối tài liệu" });
    }
};