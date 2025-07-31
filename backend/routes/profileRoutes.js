const express = require('express');
const { getProfile, updateProfile } = require('../controllers/profileController');
const authenticate = require('../middleware/authMiddleware'); // Import your existing auth middleware
const router = express.Router();

// Route to get user profile
router.get('/profile', authenticate, getProfile);

// Route to update user profile
router.put('/profile', authenticate, updateProfile);

module.exports = router;
