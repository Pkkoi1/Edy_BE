const {
    createOrganization,
    getOrganizations
} = require("../services/organization.service");

exports.createOrganization = async (req, res) => {
    try {
        const { name, code, country, address, website, description, } = req.body;
        
        const org = await createOrganization({
            name,
            code,
            country,
            address,
            website,
            description,
            created_by: req.user.userId
        });
        res.status(201).json({ message: "Tạo mới thành công", organization: org });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi tạo mới" });
    }
};

exports.getOrganizations = async (req, res) => {
    try {
        const is_dropdown = req.query.is_dropdown === 'true';
        const search = req.query.search || '';
        const organizations = await getOrganizations({ is_dropdown, search });
        res.json({ organizations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi lấy danh sách" });
    }
};