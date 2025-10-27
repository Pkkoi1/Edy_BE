const User = require("../models/user.model");
const Account = require("../models/account.model");
const Organization = require("../models/organization.model");
const Document = require("../models/document.model");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Assignment = require("../models/assignment.model");

const getUsers = async () => {
  try {
    const users = await User.find().populate("organization", "name").lean();

    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const account = await Account.findOne({ user: user._id }).lean();

        if (!account) {
          return { ...user, role_names: [] };
        }

        const assignments = await Assignment.find({ account: account._id })
          .populate("role", "name")
          .lean();

        const roleNames = assignments.map((assignment) => assignment.role.name);

        return {
          ...user,
          role_names: roleNames,
        };
      })
    );

    return usersWithRoles;
  } catch (error) {
    console.error("Error getting users:", error);
    throw new Error("Lỗi khi lấy danh sách người dùng: " + error.message);
  }
};
const verifyUser = async (accountId, userId, field_of_study, organization) => {
  const account = await Account.findById(accountId);
  if (!account) throw new Error("Tài khoản không tồn tại");
  if (account.is_verified) return { error: "Tài khoản đã được xác minh" };

  let fieldOfStudyArray = [];
  if (Array.isArray(field_of_study)) {
    fieldOfStudyArray = field_of_study;
  } else {
    fieldOfStudyArray = field_of_study
      ? field_of_study
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s)
      : [];
  }

  if (!mongoose.Types.ObjectId.isValid(organization)) {
    return { error: "Không tìm thấy tổ chức" };
  }

  const existingOrganization = await Organization.findById(organization);
  if (!existingOrganization) {
    return { error: "Không tìm thấy tổ chức" };
  }

  const user = await User.findById(userId);
  user.field_of_study = fieldOfStudyArray;
  user.organization = organization;
  await user.save();

  account.is_verified = true;
  await account.save();

  return { success: true };
};

const updateUserFieldOfStudy = async (userId, field_of_study) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { error: "Người dùng không tồn tại" };
    }

    let fieldOfStudyArray = [];
    if (Array.isArray(field_of_study)) {
      fieldOfStudyArray = field_of_study;
    } else {
      fieldOfStudyArray = field_of_study
        ? field_of_study
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s)
        : [];
    }
    user.field_of_study = fieldOfStudyArray;

    await user.save();
    return { success: true, message: "Cập nhật lĩnh vực học thành công" };
  } catch (error) {
    return { error: "Lỗi khi cập nhật lĩnh vực học: " + error.message };
  }
};

const updateUserProfile = async (
  userId,
  { first_name, last_name, organization, avatar }
) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { error: "Người dùng không tồn tại" };
    }

    // Kiểm tra organization nếu được cung cấp
    if (organization) {
      if (!mongoose.Types.ObjectId.isValid(organization)) {
        return { error: `Tổ chức không hợp lệ ` + organization };
      }

      const existingOrganization = await Organization.findById(organization);
      if (!existingOrganization) {
        return { error: "Không tìm thấy tổ chức" };
      }

      // Kiểm tra xem organization có thay đổi so với hiện tại không
      const currentOrgId = user.organization
        ? user.organization.toString()
        : null;
      const newOrgId = organization.toString();

      if (currentOrgId !== newOrgId) {
        // Chỉ kiểm tra giới hạn thời gian khi organization thực sự thay đổi
        const now = new Date();
        const lastChange = user.last_organization_change;
        if (lastChange) {
          const daysDiff = Math.floor(
            (now - lastChange) / (1000 * 60 * 60 * 24)
          );
          if (daysDiff < 30) {
            // Giới hạn thay đổi mỗi 30 ngày
            return {
              error:
                "Bạn chỉ có thể thay đổi tổ chức sau 30 ngày kể từ lần thay đổi cuối",
            };
          }
        }

        user.organization = organization;
        user.last_organization_change = now;
      }
      // Nếu organization không thay đổi, không cần làm gì
    }

    // Cập nhật các trường thông tin nếu được cung cấp
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    return { success: true, message: "Cập nhật thông tin thành công" };
  } catch (error) {
    return { error: "Lỗi khi cập nhật thông tin: " + error.message };
  }
};

const changePassword = async (
  accountId,
  { current_password, new_password }
) => {
  try {
    const account = await Account.findById(accountId);
    if (!account) {
      return { error: "Tài khoản không tồn tại" };
    }

    // Kiểm tra mật khẩu hiện tại
    const isCurrentPasswordValid = await bcrypt.compare(
      current_password,
      account.password
    );
    if (!isCurrentPasswordValid) {
      return { error: "Mật khẩu hiện tại không đúng" };
    }

    // Kiểm tra mật khẩu mới
    if (new_password.length < 6) {
      return { error: "Mật khẩu mới phải có ít nhất 6 ký tự" };
    }

    // Kiểm tra mật khẩu mới không giống mật khẩu cũ
    const isSamePassword = await bcrypt.compare(new_password, account.password);
    if (isSamePassword) {
      return { error: "Mật khẩu mới phải khác mật khẩu hiện tại" };
    }

    // Mã hóa mật khẩu mới
    const hashedNewPassword = await bcrypt.hash(new_password, 10);
    account.password = hashedNewPassword;
    await account.save();

    return { success: true, message: "Đổi mật khẩu thành công" };
  } catch (error) {
    return { error: "Lỗi khi đổi mật khẩu: " + error.message };
  }
};

const updateUserDocCount = async (userId) => {
  try {
    const docCount = await Document.countDocuments({
      user: userId,
      is_deleted: false,
    });

    await User.findByIdAndUpdate(userId, { doc_count: docCount });
    return docCount;
  } catch (error) {
    console.error("Error updating user doc count:", error);
    return 0;
  }
};

const addFavoriteDocument = async (userId, documentId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      throw new Error("ID tài liệu không hợp lệ");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    const document = await Document.findOne({
      _id: documentId,
      is_deleted: false,
    });
    if (!document) {
      throw new Error("Tài liệu không tồn tại hoặc đã bị xóa");
    }

    // Kiểm tra xem tài liệu đã có trong favorites chưa
    const existingFavorite = user.favorites.find(
      (fav) => fav.document.toString() === documentId
    );

    if (existingFavorite) {
      throw new Error("Tài liệu đã có trong danh sách yêu thích");
    }

    // Kiểm tra giới hạn danh sách yêu thích (tối đa 10)
    if (user.favorites.length >= 10) {
      throw new Error(
        "Danh sách yêu thích đã đạt giới hạn tối đa 10 tài liệu. Vui lòng xóa bớt để thêm tài liệu mới."
      );
    }

    user.favorites.push({
      document: documentId,
      added_at: new Date(),
    });

    await user.save();
    return {
      success: true,
      message: "Thêm tài liệu vào danh sách yêu thích thành công",
      favorites_count: user.favorites.length,
      remaining_slots: 10 - user.favorites.length,
    };
  } catch (error) {
    console.error("Error adding favorite document:", error);
    return {
      error: "Lỗi khi thêm tài liệu vào danh sách yêu thích: " + error.message,
    };
  }
};

const removeFavoriteDocument = async (userId, documentId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    // Xóa tài liệu khỏi danh sách yêu thích
    const originalLength = user.favorites.length;
    user.favorites = user.favorites.filter(
      (fav) => fav.document.toString() !== documentId
    );

    if (user.favorites.length === originalLength) {
      throw new Error("Tài liệu không có trong danh sách yêu thích");
    }

    await user.save();
    return {
      success: true,
      message: "Xóa tài liệu khỏi danh sách yêu thích thành công",
      favorites_count: user.favorites.length,
      remaining_slots: 10 - user.favorites.length,
    };
  } catch (error) {
    console.error("Error removing favorite document:", error);
    return {
      error: "Lỗi khi xóa tài liệu khỏi danh sách yêu thích: " + error.message,
    };
  }
};

const getFavoriteDocuments = async (userId) => {
  try {
    const user = await User.findById(userId).populate({
      path: "favorites.document",
      select:
        "_id title cover_page author published_year publisher organization subject level view download_count comment_count status public_mode is_deleted createdAt",
      populate: [
        { path: "organization", select: "_id name" },
        { path: "subject", select: "_id name" },
        { path: "user", select: "_id first_name last_name avatar" },
      ],
    });

    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    const favoriteDocuments = user.favorites.map((fav) => {
      if (fav.document) {
        const doc = fav.document.toObject();

        // Kiểm tra quyền truy cập
        // là chủ thì luôn có quyền
        let hasAccess = doc.user._id.toString() === userId;

        // nếu ko phải chủ thì đổi trạng thái hasAccess dựa vào mode và quyền
        if (!hasAccess) {
          if (doc.status === "APPROVED") {
            switch (doc.public_mode) {
              case "PUBLIC":
                hasAccess = true;
                break;
              case "SHARE_ORGANIZATION":
                // Chia sẻ trong tổ chức -> kiểm tra cùng organization
                if (user.organization && doc.user.organization) {
                  hasAccess = hasAccess
                    ? hasAccess
                    : user.organization.toString() ===
                      doc.user.organization.toString();
                }
                break;
              case "PRIVATE_SHARED":
                // Kiểm tra trong shared_documents của user\
                if (hasAccess) break;
                const isSharedToUser = user.shared_documents.some(
                  (sharedDoc) =>
                    sharedDoc.document.toString() === doc._id.toString()
                );
                // Hoặc là chủ sở hữu document
                hasAccess = isSharedToUser;
                break;
            }
          }
        }

        if (!hasAccess) {
          return {
            _id: doc._id,
            title: "Bạn không có quyền xem tài liệu này",
            is_deleted: doc.is_deleted,
            added_at: fav.added_at,
            has_access: false,
          };
        }

        return {
          ...doc,
          added_at: fav.added_at,
          has_access: hasAccess,
        };
      } else {
        // Trường hợp document bị xóa hoàn toàn khỏi DB
        return {
          _id: null,
          title: "Tài liệu đã bị xóa",
          is_deleted: true,
          added_at: fav.added_at,
          has_access: false,
        };
      }
    });

    return {
      documents: favoriteDocuments,
      total: user.favorites.length,
      max_favorites: 10,
      remaining_slots: 10 - user.favorites.length,
    };
  } catch (error) {
    console.error("Error getting favorite documents:", error);
    return {
      error: "Lỗi khi lấy danh sách tài liệu yêu thích: " + error.message,
    };
  }
};

const checkIsFavorite = async (userId, documentId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { error: "Người dùng không tồn tại" };
    }

    const isFavorite = user.favorites.some(
      (fav) => fav.document && fav.document.toString() === documentId
    );

    return {
      is_favorite: isFavorite,
      favorites_count: user.favorites.length,
      max_favorites: 10,
      remaining_slots: 10 - user.favorites.length,
    };
  } catch (error) {
    console.error("Error checking favorite status:", error);
    return { error: "Lỗi khi kiểm tra trạng thái yêu thích: " + error.message };
  }
};

const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select("-__v")
      .populate([
        { path: "organization", select: "_id name" },
        { path: "read_history.document", select: "_id title" },
        { path: "shared_documents.document", select: "_id title" },
        { path: "favorites.document", select: "_id title" },
      ]);

    if (!user) {
      return { error: "Người dùng không tồn tại" };
    }

    const account = await Account.findOne({ user: userId }).select(
      "-password -__v"
    );
    if (!account) {
      return { error: "Tài khoản không tồn tại" };
    }

    const roles = await Assignment.find({ account: account._id }).populate(
      "role"
    );
    let responseRoles = ["USER"];
    if (roles.length > 0) responseRoles = roles.map((a) => a.role.code);
    if (!account.is_verified) responseRoles = ["NOT_VERIFIED"];

    return {
      success: true,
      account,
      user: {
        ...user.toObject(),
        organization_name: user.organization ? user.organization.name : null,
      },
      roles: responseRoles,
    };
  } catch (error) {
    console.error("Error getting user by ID:", error);
    return { error: "Lỗi khi lấy thông tin người dùng: " + error.message };
  }
};

const followUser = async (currentUserId, targetUserId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new Error("ID người dùng không hợp lệ");
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
      throw new Error("Người dùng không tồn tại");
    }

    // Kiểm tra nếu đã follow
    if (currentUser.following.includes(targetUserId)) {
      throw new Error("Bạn đã follow người dùng này");
    }

    // Cập nhật danh sách following và follower
    currentUser.following.push(targetUserId);
    targetUser.follower.push(currentUserId);

    await currentUser.save();
    await targetUser.save();

    return { success: true, message: "Follow thành công" };
  } catch (error) {
    console.error("Error following user:", error);
    return { error: "Lỗi khi follow người dùng: " + error.message };
  }
};

const unfollowUser = async (currentUserId, targetUserId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new Error("ID người dùng không hợp lệ");
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
      throw new Error("Người dùng không tồn tại");
    }

    // Kiểm tra nếu chưa follow
    if (!currentUser.following.includes(targetUserId)) {
      throw new Error("Bạn chưa follow người dùng này");
    }

    // Cập nhật danh sách following và follower
    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== targetUserId
    );
    targetUser.follower = targetUser.follower.filter(
      (id) => id.toString() !== currentUserId
    );

    await currentUser.save();
    await targetUser.save();

    return { success: true, message: "Unfollow thành công" };
  } catch (error) {
    console.error("Error unfollowing user:", error);
    return { error: "Lỗi khi unfollow người dùng: " + error.message };
  }
};

const getUserPermissions = async (userId) => {
  try {
    const account = await Account.findOne({ user: userId });
    if (!account) {
      return { error: "Tài khoản không tồn tại" };
    }

    const assignments = await Assignment.find({
      account: account._id,
      is_active: true,
    }).populate("role");

    const permissions = new Set();
    assignments.forEach((assignment) => {
      if (assignment.role && assignment.role.permissions) {
        assignment.role.permissions.forEach((permission) => {
          permissions.add(permission);
        });
      }
    });

    return {
      success: true,
      permissions: Array.from(permissions),
      roles: assignments.map((assignment) => ({
        _id: assignment.role._id,
        name: assignment.role.name,
        code: assignment.role.code,
        description: assignment.role.description,
        is_active: assignment.role.is_active,
        permissions: assignment.role.permissions,
      })),
    };
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return { error: "Lỗi khi lấy quyền của người dùng: " + error.message };
  }
};

module.exports = {
  getUsers,
  verifyUser,
  updateUserProfile,
  updateUserFieldOfStudy,
  changePassword,
  updateUserDocCount,
  addFavoriteDocument,
  removeFavoriteDocument,
  getFavoriteDocuments,
  checkIsFavorite,
  getUserById,
  followUser,
  unfollowUser,
  getUserPermissions,
};
