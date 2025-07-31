const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

// @route   POST api/users
// @desc    Register user
// @access  Public
router.post(
    '/',
    [
        check('userName', 'Name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
        check('role', 'Role must be either seeker or provider').isIn(['seeker', 'provider'])
    ],
    userController.registerUser
);

// @route   PATCH api/users/status
// @desc    Update provider status
// @access  Private (Only for providers)
router.patch('/status', auth, userController.updateProviderStatus);

// @route   GET api/users/status
// @desc    Get provider status
// @access  Private (Only for providers)
router.get('/status', auth, userController.getProviderStatus);

module.exports = router;
