const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true }, // Reference to the request
    messages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
