const {getNewestDocuments, createDocument} = require("../services/document.service");
const {getOrganizationById} = require("../services/organization.service");
const {createApprovalRequest, approveRequest} = require("../services/approval_request.service");

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

exports.uploadDocument = async (req, res) => {
    try {
        // nhận thông tin tài liệu (url là link cloudinary)
        const {
            url,
            title,
            doc_type,
            file_type,
            subject,
            author,
            published_year,
            publisher,
            organization,
            level,
            intensive,
            keyword,
            description,
            page
        } = req.body;

        const org = await getOrganizationById(organization);
        if (!org) {
            return res.status(400).json({ message: "Tổ chức không hợp lệ" });
        }

        let descriptionObj = {
            summary_by_user: null,
            summary_by_ai: null
        }
        if (description && description.length > 30) {
            descriptionObj.summary_by_user = description;
        }

        const document = await createDocument({
            user: req.user.userId, // người đăng
            url,
            title,
            doc_type,
            file_type,
            subject,
            author,
            published_year,
            publisher,
            organization,
            level,
            intensive,
            keyword,
            description: descriptionObj,
            page
        });

        //Tạo approval request
        await createApprovalRequest({
            documentId: document._id,
            requesterId: req.user.userId,
        });
        
        res.status(201).json({ message: "Tải lên tài liệu thành công", document });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi tải lên tài liệu" });
    }
}

// Admin
exports.approveDocument = async (req, res) => {
    try {
        const { requestId } = req.params;
        const approverId = req.user.userId;

        const approvalRequest = await approveRequest(requestId, approverId);
        res.json({ message: "Phê duyệt tài liệu thành công", approvalRequest });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi phê duyệt tài liệu" });
    }
};