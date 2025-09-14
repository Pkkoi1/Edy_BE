const {getNewestDocuments, createDocument} = require("../services/document.service");
const {getOrganizationById} = require("../services/organization.service");

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
            description,
            page
        });
        
        res.status(201).json({ message: "Tải lên tài liệu thành công", document });
        //Tạo approval request để sau

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi tải lên tài liệu" });
    }
}