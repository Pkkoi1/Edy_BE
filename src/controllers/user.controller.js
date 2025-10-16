const {
  getUsers,
  verifyUser,
  updateUserProfile,
  changePassword,
  getFavoriteDocuments,
  addFavoriteDocument,
  removeFavoriteDocument,
  getUserById,
  followUser,
  unfollowUser,
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

exports.getFavoriteDocuments = async (req, res) => {
  try {
    const documents = await getFavoriteDocuments(req.user.userId);
    res.json(documents);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy tài liệu yêu thích" });
  }
};

exports.addFavoriteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(400).json({ message: "Vui lòng cung cấp documentId" });
    }

    const result = await addFavoriteDocument(req.user.userId, documentId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi thêm tài liệu yêu thích" });
  }
};

exports.removeFavoriteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(400).json({ message: "Vui lòng cung cấp documentId" });
    }

    const result = await removeFavoriteDocument(req.user.userId, documentId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi xóa tài liệu yêu thích" });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "Vui lòng cung cấp userId" });
    }

    const result = await getUserById(userId);
    if (result.error) {
      return res.status(404).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy thông tin người dùng" });
  }
};

exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await followUser(req.user.userId, userId);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error in followUser controller:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi follow người dùng" });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await unfollowUser(req.user.userId, userId);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error in unfollowUser controller:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi unfollow người dùng" });
  }
};
