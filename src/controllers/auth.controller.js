const Account = require("../models/account.model");
const User = require("../models/user.model");
const Role = require("../models/role.model");
const Organization = require("../models/organization.model");
const Document = require("../models/document.model");
const Assignment = require("../models/assignment.model");
const bcrypt = require("bcryptjs");
const { generateTokens } = require("../services/auth.service");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const account = await Account.findOne({ email });

    if (!account) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }
    const valid = await bcrypt.compare(password, account.password);
    if (!valid) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }
    // Lấy danh sách vai trò đã đc gán
    let roles = [];
    if (!account.is_verified) 
      roles = ["NOT_VERIFY"];
    else if (!account.is_admin)
      roles = ["USER"];
    else {
      roles = await Assignment.find({ account: account._id }).populate("role");
      if (roles.length === 0) {
        roles = ["USER"];
      }
    }
    if (roles.length > 0 && roles[0] !== "NOT_VERIFY" && roles[0] !== "USER") {
      roles = roles.map(a => a.role.code);
    }

    const payload = {
      accountId: account._id,
      userId: account.user._id,
      roles: roles
    };
    const { accessToken, refreshToken } = generateTokens(payload);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ message: "Đăng nhập thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đăng nhập" });
  };
};

exports.register = async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    // kiểm tra user tồn tài
    const existingAccount = await Account.findOne({ email });
    if (existingAccount) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    // Tạo mới user
    const user = new User({
      first_name, last_name, contact_email: email,
    });
    await user.save();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // tạo mới tài khoản
    const account = new Account({
      user: user._id,
      email: email,
      password: hashedPassword,
      is_vip: false,
      is_admin: false,
    });
    await account.save();

    // Assign role (để sau)

    res.status(201).json({ message: "Đăng ký thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đăng ký" });
  };
};

exports.logout = async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Đăng xuất thành công" });
}

exports.refreshToken = async (req, res) => {
  try {

    const { accessToken, newRefreshToken } = generateTokens(req.user);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    })
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.json({ message: "Refresh token thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi refresh token" });
  };
}

exports.me = async (req, res) => {
  try {
    const account = await Account.findById(req.user.accountId).select('-password -__v');
    const user = await User.findById(req.user.userId)
      .select('-__v')
      .populate([
        {
          path: 'organization',
          select: '_id name'
        },
        {
          path: 'read_history.document',
          select: '_id title'
        },
        {
          path: 'shared_documents.document',
          select: '_id title'
        },
        {
          path: 'favorites.document',
          select: '_id title'
        }
      ]);

    const roles = await Assignment.find({
      account: account._id,
    }).populate("role");

    let responseRoles = ['USER']

    if (roles.length > 0) {
      responseRoles = roles;
    }

    if (!account.is_verified) {
      responseRoles = ['NOT_VERIFIED']
    }

    res.json({
      account: account,
      user: user,
      roles: responseRoles,
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy thông tin tài khoản" });
  };
}