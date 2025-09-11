const Account = require('../models/account.model');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const Assignment = require('../models/assignment.model');
const bcrypt = require('bcryptjs');
const { generateTokens } = require('../services/auth.service');

exports.login = async (req, res) => {
    const { email, password } = req.body;
    const account = await Account.findOne({}).populate('user_id');
    if (!account || account.user_id.email !== email) {
        return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
    }
    const valid = await bcrypt.compare(password, account.password);
    if (!valid) {
        return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
    }
    // Lấy danh sách vai trò đã đc gán
    const assignments = await Assignment.find({ account_id: account._id }).populate('role_id');
    const roles = assignments.length > 0
        ? assignments.map(a => a.role_id.code)
        : ['USER'];

    const payload = {
        accountId: account._id,
        userId: account.user_id._id,
        roles
    };
    const { accessToken, refreshToken } = generateTokens(payload);

    res.cookie('accessToken', accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ message: 'Đăng nhập thành công' });
};

exports.register = async (req, res) => {
    const { first_name, last_name, email, password } = req.body;
    // kiểm tra user tồn tài
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: 'Email đã được sử dụng' });
    }
    // Tạo mới user
    const user = new User({ first_name, last_name, email });
    await user.save();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // tạo mới tài khoản
    const account = new Account({
        user_id: user._id,
        password: hashedPassword,
        is_vip: false,
        is_admin: false
    });
    await account.save();

    // Assign role (để sau)

    res.status(201).json({ message: 'Đăng ký thành công' });
};