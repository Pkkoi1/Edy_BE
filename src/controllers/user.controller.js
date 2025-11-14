const {
  getUsers,
  verifyUser,
  updateUserProfile,
  updateUserFieldOfStudy,
  changePassword,
  getFavoriteDocuments,
  addFavoriteDocument,
  removeFavoriteDocument,
  getUserById,
  followUser,
  unfollowUser,
  getUserPermissions,
  getUserContributions,
  updateUserStatus,
} = require("../services/user.service");

exports.getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      field_of_study,
      status,
      rank_point_min,
      rank_point_max,
      strike_min,
      strike_max,
    } = req.query;

    // Validate parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        message: "Tham số không hợp lệ. Page >= 1, 1 <= limit <= 100",
      });
    }

    // Build filters object
    const filters = {};

    if (field_of_study) {
      filters.field_of_study = Array.isArray(field_of_study)
        ? field_of_study
        : [field_of_study];
    }

    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      // Validate status values
      const validStatuses = ["ACTIVE", "INACTIVE", "BANNED"];
      const invalidStatuses = statusArray.filter(
        (s) => !validStatuses.includes(s)
      );
      if (invalidStatuses.length > 0) {
        return res.status(400).json({
          message: `Trạng thái không hợp lệ: ${invalidStatuses.join(
            ", "
          )}. Các giá trị hợp lệ: ACTIVE, INACTIVE, BANNED`,
        });
      }
      filters.status = statusArray;
    }

    if (rank_point_min !== undefined) {
      const min = parseInt(rank_point_min);
      if (isNaN(min) || min < 0) {
        return res.status(400).json({
          message: "rank_point_min phải là số nguyên không âm",
        });
      }
      filters.rank_point_min = min;
    }

    if (rank_point_max !== undefined) {
      const max = parseInt(rank_point_max);
      if (isNaN(max) || max < 0) {
        return res.status(400).json({
          message: "rank_point_max phải là số nguyên không âm",
        });
      }
      filters.rank_point_max = max;
    }

    if (strike_min !== undefined) {
      const min = parseInt(strike_min);
      if (isNaN(min) || min < 0) {
        return res.status(400).json({
          message: "strike_min phải là số nguyên không âm",
        });
      }
      filters.strike_min = min;
    }

    if (strike_max !== undefined) {
      const max = parseInt(strike_max);
      if (isNaN(max) || max < 0) {
        return res.status(400).json({
          message: "strike_max phải là số nguyên không âm",
        });
      }
      filters.strike_max = max;
    }

    const result = await getUsers(pageNum, limitNum, search.trim(), filters);
    res.json(result);
  } catch (error) {
    console.error("Error in getUsers controller:", error);
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

exports.updateFieldOfStudy = async (req, res) => {
  try {
    const { field_of_study } = req.body;
    const result = await updateUserFieldOfStudy(
      req.user.userId,
      field_of_study
    );

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json({ message: result.message });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi cập nhật lĩnh vực học" });
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

exports.getUserContributions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { year } = req.query;

    const result = await getUserContributions(userId, year);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error in getUserContributions controller:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy thành tích đóng góp của người dùng",
    });
  }
};

exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "Vui lòng cung cấp userId" });
    }

    const result = await getUserPermissions(userId);
    if (result.error) {
      return res.status(404).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error in getUserPermissions controller:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy quyền của người dùng" });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Vui lòng cung cấp userId" });
    }

    if (!status) {
      return res.status(400).json({ message: "Vui lòng cung cấp status" });
    }

    const result = await updateUserStatus(userId, status, req.user.userId);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error in updateUserStatus controller:", error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi cập nhật trạng thái người dùng" });
  }
};
