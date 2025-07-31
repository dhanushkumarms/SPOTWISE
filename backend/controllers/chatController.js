const Chat = require('../models/ChatModel');
const ServiceRequest = require('../models/ServiceRequestModel');

// Initialize chat for a service request
exports.initializeChat = async (req, res) => {
    try {
        const { requestId } = req.params;
        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) {
            return res.status(404).json({ message: 'Service request not found' });
        }

        // Check if chat already exists
        let chat = await Chat.findOne({
            serviceRequest: requestId,
            provider: serviceRequest.provider,
            seeker: serviceRequest.seeker
        });

        if (chat) {
            return res.status(200).json(chat);
        }

        // Create new chat
        chat = new Chat({
            serviceRequest: requestId,
            provider: serviceRequest.provider,
            seeker: serviceRequest.seeker,
            messages: []
        });

        await chat.save();
        res.status(201).json(chat);
    } catch (error) {
        console.error('Chat initialization error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get chat history
exports.getChatHistory = async (req, res) => {
    try {
        const { chatId } = req.params;
        const chat = await Chat.findById(chatId)
            .populate('messages.sender', 'userName')
            .populate('provider', 'userName')
            .populate('seeker', 'userName');

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        // Verify user is part of the chat
        if (chat.provider.toString() !== req.user.id && 
            chat.seeker.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to view this chat' });
        }

        res.status(200).json(chat);
    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark messages as read
exports.markMessagesAsRead = async (req, res) => {
    try {
        const { chatId } = req.params;
        const chat = await Chat.findById(chatId);

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        // Mark unread messages as read
        chat.messages.forEach(message => {
            if (message.sender.toString() !== req.user.id && !message.read) {
                message.read = true;
            }
        });

        await chat.save();
        res.status(200).json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Mark messages as read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};