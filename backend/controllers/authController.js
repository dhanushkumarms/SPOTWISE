const User = require('../models/UserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Register a new user
exports.register = async (req, res) => {
    // Validate incoming request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { userName, email, password, role } = req.body;

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user instance with the required fields only
        user = new User({
            userName,
            email,
            password,
            role
        });

        // Save user to database (password hashing is handled in the model)
        await user.save();

        // Create JWT payload
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        // Sign JWT token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },  // Token expires in 1 hour
            (err, token) => {
                if (err) throw err;
                res.status(201).json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if user exists
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // If user is a provider, update status to online
        if (user.role === 'provider') {
            user.status = 'online';
            await user.save();
        }

        // Create and return JWT token
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ 
                    token,
                    userId: user.id,
                    userName: user.userName,
                    role: user.role,
                    status: user.status || 'offline'
                });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get logged in user
// @route   GET /api/auth/user
// @access  Private
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Logout user (if they're a provider, set status to offline)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
    try {
        // If user is a provider, update status to offline
        const user = await User.findById(req.user.id);
        
        if (user && user.role === 'provider') {
            user.status = 'offline';
            await user.save();
        }
        
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
};
