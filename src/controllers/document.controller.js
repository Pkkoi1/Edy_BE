const {getNewestDocuments} = require("../services/document.service");

exports.getNewestDocuments = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 5;
        page = page < 1 ? 1 : page;
        limit = limit < 1 ? 1 : limit;
        const result = await getNewestDocuments(req.user, page, limit);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi lấy tài liệu" });
    }
};