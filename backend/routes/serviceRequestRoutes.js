const express = require('express');
const { check } = require('express-validator');
const {
    createRequest,
    getActiveRequests,
    acceptRequest,
    completeRequest,
    getRequestHistory,
    getRequestPin,
    cancelRequest
} = require('../controllers/serviceRequestController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Route to create a new service request (only seekers)
router.post('/create', [
    authMiddleware,
    check('category', 'Category is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('contactNumber', 'Contact number is required').isLength({ min: 10, max: 10 }),
    check('location', 'Location is required').not().isEmpty(),
    check('duration', 'Duration is required').isInt({ min: 1 })
], createRequest);

// Route to fetch active requests (only providers)
router.get('/active', authMiddleware, getActiveRequests);

// Route to accept a service request (only providers)
router.patch('/accept/:id', authMiddleware, acceptRequest);

// Route to mark request as completed (with PIN verification)
router.patch('/complete/:id', authMiddleware, completeRequest);

// Route to get request history (for both seekers and providers)
router.get('/history', authMiddleware, getRequestHistory);

// Route to get verification PIN for a specific request (seekers only)
router.get('/pin/:id', authMiddleware, getRequestPin);

// Route to cancel a service request (only by the seeker who created it)
router.patch('/cancel/:id', authMiddleware, cancelRequest);

module.exports = router;
