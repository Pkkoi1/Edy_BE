const {getNewestDocuments} = require("../services/document.service");

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