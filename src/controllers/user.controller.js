const {
  getUsers,
  verifyUser,
  updateUserProfile,
  changePassword,
} = require("../services/user.service");

exports.getUsers = async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

exports.updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, organization, avatar } = req.body;
    const result = await updateUserProfile(req.user.userId, {
      first_name,
      last_name,
      organization,
      avatar,
    });

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json({ message: result.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi cập nhật thông tin" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp đầy đủ thông tin" });
    }

    const result = await changePassword(req.user.accountId, {
      current_password,
      new_password,
    });

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json({ message: result.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đổi mật khẩu" });
  }
};
