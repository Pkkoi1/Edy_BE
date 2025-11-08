const Account = require("../models/account.model");
const User = require("../models/user.model");
const Assignment = require("../models/assignment.model");
const Restriction = require("../models/restriction.model");
const OTP = require("../models/otp.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { createPointTransaction } = require("./point_transaction.service");
const { getUserPermissions } = require("./user.service");

const generateTokens = (payload) => {
  // Chỉ lấy những trường cần thiết, tránh các trường JWT tự động thêm
  const cleanPayload = {
    accountId: payload.accountId,
    userId: payload.userId,
    roles: payload.roles,
  };

  const accessToken = jwt.sign(cleanPayload, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign(cleanPayload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
};

const loginService = async ({ email, password }) => {
  const account = await Account.findOne({ email });
  if (!account) return { error: "Sai tài khoản hoặc mật khẩu", status: 401 };
  const valid = await bcrypt.compare(password, account.password);
  if (!valid) return { error: "Sai tài khoản hoặc mật khẩu", status: 401 };

  // Kiểm tra restriction
  const now = new Date();
  const activeRestriction = await Restriction.findOne({
    account: account._id,
    type: "LOGIN",
    start_date: { $lte: now },
    end_date: { $gte: now },
  });

  if (activeRestriction) {
    return {
      error: `Tài khoản bị hạn chế đến ${activeRestriction.end_date}. Lý do: ${activeRestriction.reason}`,
      status: 403,
    };
  }

  // Lấy roles
  let roles = [];
  if (!account.is_verified) roles = ["NOT_VERIFIED"];
  else if (!account.is_admin) roles = ["USER"];
  else {
    const assignments = await Assignment.find({
      account: account._id,
      is_active: true,
    }).populate("role");
    roles = assignments.length ? assignments.map((a) => a.role.code) : ["USER"];
  }

  const payload = {
    accountId: account._id,
    userId: account.user._id,
    roles,
  };
  const { accessToken, refreshToken } = generateTokens(payload);
  return { accessToken, refreshToken };
};

const registerService = async ({ first_name, last_name, email, password }) => {
  const existingAccount = await Account.findOne({ email });
  if (existingAccount) return { error: "Email đã được sử dụng", status: 400 };

  const user = new User({ first_name, last_name, contact_email: email });
  await user.save();

  const hashedPassword = await bcrypt.hash(password, 10);
  const account = new Account({
    user: user._id,
    email,
    password: hashedPassword,
    is_vip: false,
    is_admin: false,
  });
  await account.save();

  // Cộng 5 điểm cho tài khoản mới
  try {
    await createPointTransaction(
      user._id,
      "EARN",
      5,
      "Điểm thưởng đăng ký tài khoản mới",
      "BOTH"
    );
  } catch (pointError) {
    console.error("Error creating registration bonus points:", pointError);
    // Không trả về lỗi nếu việc cộng điểm thất bại
  }

  return { success: true, userId: user._id };
};

const getMeService = async (payload, accessToken, refreshToken) => {
  let finalPayload = payload;
  let newTokens = null;

  if (!accessToken || !payload || !payload.userId) {
    if (!refreshToken) {
      throw new Error("Access token expired and no refresh token provided");
    }

    const refreshPayload = verifyToken(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );
    if (!refreshPayload) {
      throw new Error("Invalid refresh token");
    }

    newTokens = await refreshTokenService(refreshPayload);
    finalPayload = verifyToken(newTokens.accessToken, process.env.JWT_SECRET);
  }

  const account = await Account.findById(finalPayload.accountId).select(
    "-password -__v"
  );
  const user = await User.findById(finalPayload.userId)
    .select("-__v")
    .populate([
      { path: "organization", select: "_id name" },
      {
        path: "read_history.document",
        select:
          "_id title status public_mode user cover_page organization file_type subject is_deleted",
        populate: [
          { path: "user", select: "first_name last_name" },
          { path: "subject", select: "_id name code description organization" },
        ],
      },
      {
        path: "shared_documents.document",
        select:
          "_id title user page subject organization file_type subject is_deleted like dislike",
        populate: [
          { path: "user", select: "_id first_name last_name" },
          { path: "subject", select: "_id name code" },
          { path: "organization", select: "_id name code" },
        ],
      },
      {
        path: "favorites.document",
        select: "_id title status public_mode is_deleted",
      },
      {
        path: "follower",
        select:
          "_id first_name last_name rank_point doc_count field_of_study avatar",
        populate: { path: "organization", select: "_id name" },
      },
      {
        path: "following",
        select:
          "_id first_name last_name rank_point doc_count field_of_study avatar",
        populate: { path: "organization", select: "_id name" },
      },
    ]);

  const roles = await Assignment.find({
    account: account._id,
    is_active: true,
  }).populate("role");
  let responseRoles = ["USER"];
  if (roles.length > 0) responseRoles = roles.map((a) => a.role.code);
  if (!account.is_verified) responseRoles = ["NOT_VERIFIED"];

  // Get user permissions
  const permissions = await getUserPermissions(user._id);

  // Convert to plain object and add permissions
  const userObj = user.toObject();
  userObj.permissions = permissions.permissions;

  return { account, user: userObj, roles: responseRoles, newTokens };
};

const refreshTokenService = async (payload) => {
  console.log("Refresh token payload:", payload); // Debug log

  // Kiểm tra payload có accountId không
  if (!payload.accountId) {
    throw new Error("Invalid token payload: missing accountId");
  }

  // Lấy thông tin account từ database
  const account = await Account.findById(payload.accountId).populate("user");
  if (!account) {
    throw new Error("Account not found");
  }

  // Lấy roles mới từ database
  let roles = [];
  if (!account.is_verified) roles = ["NOT_VERIFIED"];
  else if (!account.is_admin) roles = ["USER"];
  else {
    const assignments = await Assignment.find({
      account: account._id,
      is_active: true,
    }).populate("role");
    roles = assignments.length ? assignments.map((a) => a.role.code) : ["USER"];
  }

  // Tạo payload mới với thông tin từ database
  const updatedPayload = {
    accountId: account._id.toString(),
    userId: account.user._id.toString(),
    roles,
  };

  console.log("Updated payload for new tokens:", updatedPayload); // Debug log

  const { accessToken, refreshToken } = generateTokens(updatedPayload);
  return { accessToken, refreshToken };
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};

// Tạo transporter email
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Tạo OTP ngẫu nhiên 6 chữ số
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Gửi OTP qua email
const sendOTP = async (email, otp) => {
  try {
    const transporter = createEmailTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Mã OTP xác thực tài khoản - Edy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Xác thực tài khoản Edy</h2>
          <p>Xin chào,</p>
          <p>Mã OTP của bạn là:</p>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>Mã này sẽ hết hạn sau 10 phút.</p>
          <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
          <br>
          <p>Trân trọng,<br>Đội ngũ Edy</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { error: "Không thể gửi email OTP" };
  }
};

// Tạo và gửi OTP
const createOTPService = async (email, type = "REGISTER") => {
  try {
    // Kiểm tra email đã tồn tại chưa (cho đăng ký)
    if (type === "REGISTER") {
      const existingAccount = await Account.findOne({ email });
      if (existingAccount) {
        return { error: "Email đã được sử dụng", status: 400 };
      }
    }

    // Xóa OTP cũ của email này
    await OTP.deleteMany({ email, type, isUsed: false });

    // Tạo OTP mới
    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    const otpDoc = new OTP({
      email,
      otp: hashedOTP,
      type,
    });

    await otpDoc.save();

    // Gửi email
    const emailResult = await sendOTP(email, otp);
    if (emailResult.error) {
      return { error: emailResult.error, status: 500 };
    }

    return { success: true, message: "OTP đã được gửi đến email của bạn" };
  } catch (error) {
    console.error("Error creating OTP:", error);
    return { error: "Không thể tạo OTP", status: 500 };
  }
};

// Xác thực OTP
const verifyOTPService = async (email, otp, type = "REGISTER") => {
  try {
    const otpDoc = await OTP.findOne({
      email,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      return { error: "OTP không hợp lệ hoặc đã hết hạn", status: 400 };
    }

    const isValidOTP = await bcrypt.compare(otp, otpDoc.otp);
    if (!isValidOTP) {
      return { error: "OTP không đúng", status: 400 };
    }

    // Đánh dấu OTP đã sử dụng
    otpDoc.isUsed = true;
    await otpDoc.save();

    return { success: true, message: "OTP hợp lệ" };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return { error: "Không thể xác thực OTP", status: 500 };
  }
};

// Tạo mật khẩu ngẫu nhiên theo yêu cầu validation
const generateRandomPassword = () => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const specialChars = "!@#"; // Chỉ sử dụng 3 ký tự đặc biệt: ! @ #

  // Đảm bảo có ít nhất 1 ký tự mỗi loại
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)]; // Chỉ 1 ký tự đặc biệt

  // Thêm các ký tự ngẫu nhiên còn lại để đạt độ dài tối thiểu 8
  const allChars = uppercase + lowercase + numbers + specialChars;
  for (let i = password.length; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle password để không có pattern cố định
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

// Gửi email mật khẩu mới
const sendNewPassword = async (email, newPassword) => {
  try {
    const transporter = createEmailTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Mật khẩu mới - Edy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Mật khẩu mới cho tài khoản Edy</h2>
          <p>Xin chào,</p>
          <p>Chúng tôi đã tạo mật khẩu mới cho tài khoản của bạn:</p>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #dc3545; font-size: 24px; margin: 0; word-break: break-all;">${newPassword}</h1>
          </div>
          <p><strong>Lưu ý:</strong> Vui lòng đổi mật khẩu ngay sau khi đăng nhập để bảo mật tài khoản.</p>
          <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng liên hệ với chúng tôi ngay lập tức.</p>
          <br>
          <p>Trân trọng,<br>Đội ngũ Edy</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending new password email:", error);
    return { error: "Không thể gửi email mật khẩu mới" };
  }
};

// Quên mật khẩu - tạo mật khẩu mới và gửi email
const forgotPasswordService = async (email) => {
  try {
    // Kiểm tra email có tồn tại không
    const account = await Account.findOne({ email });
    if (!account) {
      return { error: "Email không tồn tại trong hệ thống", status: 404 };
    }

    // Tạo mật khẩu mới
    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu trong database
    account.password = hashedPassword;
    await account.save();

    // Gửi email mật khẩu mới
    const emailResult = await sendNewPassword(email, newPassword);
    if (emailResult.error) {
      return { error: emailResult.error, status: 500 };
    }

    return {
      success: true,
      message: "Mật khẩu mới đã được gửi đến email của bạn",
    };
  } catch (error) {
    console.error("Error in forgot password service:", error);
    return { error: "Không thể đặt lại mật khẩu", status: 500 };
  }
};

module.exports = {
  generateTokens,
  loginService,
  registerService,
  getMeService,
  refreshTokenService,
  verifyToken,
  createOTPService,
  verifyOTPService,
  forgotPasswordService,
};
