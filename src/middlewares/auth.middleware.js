const User = require('../models/user.model');
const Account = require('../models/account.model');
const { verifyToken } = require('../services/auth.service');

exports.requireUserRole = (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ message: 'Chưa xác thực' });

    const payload = verifyToken(token, process.env.JWT_SECRET);
    if (!payload) return res.status(401).json({ message: 'Mã xác thực hông hợp lệ' });

    if (!payload.roles || !payload.roles.includes('USER')) {
        return res.status(403).json({ message: 'Không có quyền' });
    }

    req.user = payload;
    next();
};

exports.requireLoggedIn = (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ message: 'Chưa xác thực' });

    const payload = verifyToken(token, process.env.JWT_SECRET);
    if (!payload) return res.status(401).json({ message: 'Mã xác thực hông hợp lệ' });

    req.user = payload;
    next();
}

exports.refreshToken = (req, res, next) => {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: 'Chưa xác thực' });

    const payload = verifyToken(token, process.env.JWT_SECRET);
    if (!payload) return res.status(401).json({ message: 'Mã xác thực hông hợp lệ' });

    req.user = payload;
    next() 
}