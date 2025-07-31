const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// Initialize chat for a service request
router.post('/init/:requestId', authMiddleware, chatController.initializeChat);

// Get chat history
router.get('/:chatId', authMiddleware, chatController.getChatHistory);

// Mark messages as read
router.put('/:chatId/read', authMiddleware, chatController.markMessagesAsRead);

module.exports = router;