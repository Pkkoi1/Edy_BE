const {
  loginService,
  registerService,
  getMeService,
  refreshTokenService,
  createOTPService,
  verifyOTPService,
} = require("../services/auth.service");

const isProduction = process.env.NODE_ENV === "production";

exports.login = async (req, res) => {
  try {
    const result = await loginService(req.body);
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    // Set cookie ở controller
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
      secure: true,
      sameSite: "none",
    });

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: true,
      sameSite: "none",
    });
    res.json({ message: "Đăng nhập thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đăng nhập" });
  }
};

exports.register = async (req, res) => {
  try {
    const result = await registerService(req.body);
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    res.status(201).json({ message: "Đăng ký thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đăng ký" });
  }
};

exports.me = async (req, res) => {
  try {
    const result = await getMeService(req.user);
    res.json(result);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy thông tin tài khoản" });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const result = await refreshTokenService(req.user);
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
      secure: true,
      sameSite: "none",
    });
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: true,
      sameSite: "none", 
    });
    res.json({ message: "Refresh token thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi refresh token" });
  }
};

exports.logout = async (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Đăng xuất thành công" });
};

exports.createOTP = async (req, res) => {
  try {
    const { email, type } = req.body;
    const result = await createOTPService(email, type || "REGISTER");
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    res.json({ message: result.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi tạo OTP" });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    const result = await verifyOTPService(email, otp, type || "REGISTER");
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    res.json({ message: result.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi xác thực OTP" });
  }
};

exports.registerWithOTP = async (req, res) => {
  try {
    const { first_name, last_name, email, password, otp } = req.body;

    // Xác thực OTP trước
    const otpResult = await verifyOTPService(email, otp, "REGISTER");
    if (otpResult.error) {
      return res
        .status(otpResult.status || 400)
        .json({ message: otpResult.error });
    }

    // Đăng ký tài khoản
    const result = await registerService({
      first_name,
      last_name,
      email,
      password,
    });
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });

    res.status(201).json({ message: "Đăng ký thành công với OTP" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đăng ký với OTP" });
  }
};
