const User = require("../models/user.model");
const Account = require("../models/account.model");
const Organization = require("../models/organization.model");
const Document = require("../models/document.model");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const getUsers = async () => {
  return await User.find();
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

module.exports = {
  getUsers,
  verifyUser,
  updateUserProfile,
  changePassword,
  updateUserDocCount,
};
