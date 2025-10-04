const User = require('../models/user.model');
const Account = require('../models/account.model');
const Role = require('../models/role.model');
const Restriction = require('../models/restriction.model');
const { verifyToken } = require('../services/auth.service');

exports.requireUserRole = async (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ message: 'Chưa xác thực' });

    const payload = verifyToken(token, process.env.JWT_SECRET);
    if (!payload) return res.status(401).json({ message: 'Mã xác thực hông hợp lệ' });

    if (!payload.roles || payload.roles.includes('NOT_VERIFIED')) {
        return res.status(403).json({ message: 'Không có quyền' });
    }

    const now = new Date();
    const activeRestriction = await Restriction.findOne({
        account: payload.accountId,
        type: 'LOGIN',
        start_date: { $lte: now },
        end_date: { $gte: now }
    });
    if (activeRestriction) {
        return res.status(403).json({ message: `Tài khoản bị hạn chế đến ${activeRestriction.end_date}. Lý do: ${activeRestriction.reason}` });
    }
    req.user = payload;
    next();
};

exports.userOrUnauthenticated = async (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) {
        req.user = null;
        return next();
    }
    const payload = verifyToken(token, process.env.JWT_SECRET);
    if (!payload) {
        req.user = null;
        return next();
    }

    const now = new Date();
    const activeRestriction = await Restriction.findOne({
        account: payload.accountId,
        type: 'LOGIN',
        start_date: { $lte: now },
        end_date: { $gte: now }
    });
    if (activeRestriction) {
        return res.status(403).json({ message: `Tài khoản bị hạn chế đến ${activeRestriction.end_date}. Lý do: ${activeRestriction.reason}` });
    }
    req.user = payload;
    next();
}

exports.requireLoggedIn = async (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ message: 'Chưa xác thực' });

    const payload = verifyToken(token, process.env.JWT_SECRET);
    if (!payload) return res.status(401).json({ message: 'Mã xác thực hông hợp lệ' });

    // Kiểm tra tài khoản có bị khóa không
    const now = new Date();
    const activeRestriction = await Restriction.findOne({
        account: payload.accountId,
        type: 'LOGIN',
        start_date: { $lte: now },
        end_date: { $gte: now }
    });
    if (activeRestriction) {
        return res.status(403).json({ message: `Tài khoản bị hạn chế đến ${activeRestriction.end_date}. Lý do: ${activeRestriction.reason}` });
    }
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

exports.requireAdminPermission = (permissions = []) => {
    return async (req, res, next) => {
        const token = req.cookies.accessToken;
        if (!token) return res.status(401).json({ message: 'Chưa xác thực' });

        const payload = verifyToken(token, process.env.JWT_SECRET);
        if (!payload) return res.status(401).json({ message: 'Mã xác thực không hợp lệ' });

        const adminRoles = [
            'SUPER_ADMIN',
            'DOCUMENT_ADMIN',
            'USER_ADMIN',
            'SYSTEM_ADMIN',
            'ENTITY_ADMIN',
            'CUSTOM_ROLE'
        ];
        const userAdminRoles = payload.roles.filter(role => adminRoles.includes(role));
        if (userAdminRoles.length === 0 || payload.roles.includes('NOT_VERIFIED')) {
            return res.status(403).json({ message: 'Không có quyền admin' });
        }

        if (payload.roles.includes('SUPER_ADMIN')) {
            req.user = payload;
            return next();
        }

        const roles = await Role.find({ code: { $in: userAdminRoles } });
        const hasPermission = roles.some(role =>
            role.permissions.includes('ALL') ||
            role.permissions.some(p => permissions.includes(p))
        );
        if (!hasPermission) {
            return res.status(403).json({ message: 'Không có quyền' });
        }

        req.user = payload;
        next();
    };
};