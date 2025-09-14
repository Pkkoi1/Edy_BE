const Account = require("../models/account.model");
const User = require("../models/user.model");
const Assignment = require("../models/assignment.model");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');

const generateTokens = (payload) => {
    const cleanPayload = { ...payload };
    delete cleanPayload.exp;
    delete cleanPayload.iat;
    delete cleanPayload.nbf;
    const accessToken = jwt.sign(cleanPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(cleanPayload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

const loginService = async ({ email, password }) => {
    const account = await Account.findOne({ email });
    if (!account) return { error: "Sai tài khoản hoặc mật khẩu", status: 401 };
    const valid = await bcrypt.compare(password, account.password);
    if (!valid) return { error: "Sai tài khoản hoặc mật khẩu", status: 401 };

    // Lấy roles
    let roles = [];
    if (!account.is_verified) roles = ["NOT_VERIFY"];
    else if (!account.is_admin) roles = ["USER"];
    else {
        const assignments = await Assignment.find({ account: account._id }).populate("role");
        roles = assignments.length ? assignments.map(a => a.role.code) : ["USER"];
    }

    const payload = {
        accountId: account._id,
        userId: account.user._id,
        roles
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
    return { success: true };
};

const getMeService = async (payload) => {
    const account = await Account.findById(payload.accountId).select('-password -__v');
    const user = await User.findById(payload.userId)
        .select('-__v')
        .populate([
            { path: 'organization', select: '_id name' },
            { path: 'read_history.document', select: '_id title' },
            { path: 'shared_documents.document', select: '_id title' },
            { path: 'favorites.document', select: '_id title' }
        ]);
    const roles = await Assignment.find({ account: account._id }).populate("role");
    let responseRoles = ['USER'];
    if (roles.length > 0) responseRoles = roles.map(a => a.role.code);
    if (!account.is_verified) responseRoles = ['NOT_VERIFY'];
    return { account, user, roles: responseRoles };
};

const refreshTokenService = async (payload) => {
    const { accessToken, refreshToken } = generateTokens(payload);
    return { accessToken, refreshToken };
};

const verifyToken = (token, secret) => {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        return null;
    }
};

module.exports = {
    generateTokens,
    loginService,
    registerService,
    getMeService,
    refreshTokenService,
    verifyToken
};