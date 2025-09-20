const { loginService, registerService, getMeService, refreshTokenService } = require('../services/auth.service');

exports.login = async (req, res) => {
  try {
    const result = await loginService(req.body);
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
    // Set cookie ở controller
    res.cookie("accessToken", result.accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie("refreshToken", result.refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ message: "Đăng nhập thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi đăng nhập" });
  }
};

exports.register = async (req, res) => {
  try {
    const result = await registerService(req.body);
    if (result.error) return res.status(result.status || 400).json({ message: result.error });
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
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy thông tin tài khoản" });
  }
};
//
exports.refreshToken = async (req, res) => {
  try {
    const result = await refreshTokenService(req.user);
    res.cookie("accessToken", result.accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie("refreshToken", result.refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
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