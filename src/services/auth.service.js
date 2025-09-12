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

const verifyToken = (token, secret) => {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        return null;
    }
};

module.exports = { generateTokens, verifyToken };