const jwt = require('jsonwebtoken');
const User = require('../models/UserModel')

module.exports = function (req, res, next) {
    // Get token from header
    const authHeader = req.header('Authorization');

    // Check if no token or incorrect format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1];  // Extract token after 'Bearer'

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('JWT verification error:', err.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};
