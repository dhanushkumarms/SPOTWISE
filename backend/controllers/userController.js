const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const config = require('config');

const User = require('../models/User');

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
exports.registerUser = async (req, res) => {
    // ...existing code...
};

// @desc    Update provider status
// @route   PATCH /api/users/status
// @access  Private (Providers only)
exports.updateProviderStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Check if user exists
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if user is a provider
        if (user.role !== 'provider') {
            return res.status(403).json({ message: 'Only providers can update their status' });
        }
        
        // Get status from request body
        const { status } = req.body;
        
        // Validate status
        const validStatuses = ['online', 'offline', 'active', 'in-progress'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }
        
        // Update user status
        user.status = status;
        await user.save();
        
        return res.json({ status: user.status });
    } catch (error) {
        console.error('Update provider status error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get provider status
// @route   GET /api/users/status
// @access  Private (Providers only)
exports.getProviderStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Check if user exists
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if user is a provider
        if (user.role !== 'provider') {
            return res.status(403).json({ message: 'Only providers have status' });
        }
        
        return res.json({ status: user.status || 'offline' });
    } catch (error) {
        console.error('Get provider status error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
