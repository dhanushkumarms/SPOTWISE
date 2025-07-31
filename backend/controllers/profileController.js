const User = require('../models/UserModel'); // Assuming User schema is in this path
const mongoose = require('mongoose');

// Get User Profile
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id; // Extract user ID from authenticated request
        const user = await User.findById(userId).select('-password'); // Exclude password field

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Update User Profile
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id; // Extract user ID from authenticated request
        const { userName, contactNumber, address, skills, location } = req.body; // Destructure fields from request body

        // Find user by ID
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update profile fields
        user.userName = userName || user.userName; // Update userName if provided
        user.contactNumber = contactNumber || user.contactNumber; // Update contact number if provided
        user.address = address || user.address; // Update address if provided
        user.location = location || user.location;
        // Update skills only for providers
        if (user.role === 'provider') {
            user.skills = skills || user.skills; // Update skills if provided
        }

        await user.save(); // Save the updated user details

        return res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getProfile, updateProfile };
