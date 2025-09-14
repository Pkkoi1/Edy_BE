const {getUsers ,verifyUser } = require('../services/user.service');


exports.getUsers = async (req, res) => {
    try{
        const users = await getUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message }) 
    }
};

exports.verifyUser = async (req, res) => {
    try {
        const { field_of_study, organization } = req.body;
        const result = await verifyUser(
            req.user.accountId,
            req.user.userId,
            field_of_study,
            organization
        );
        if (result.error) {
            return res.status(400).json({ message: result.error });
        }
        res.json({ message: "Thêm thông tin thành công" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi thêm thông tin" });
    }
};