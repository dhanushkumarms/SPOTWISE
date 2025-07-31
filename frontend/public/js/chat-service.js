/**
 * SpotWise Chat Service
 * Handles real-time messaging between service providers and seekers
 */

class ChatService {
    constructor() {
        this.activeChat = null;
        this.unreadMessages = new Map(); // Track unread messages per chat
    }

    // Initialize chat functionality
    init() {
        this.setupChatPanel();
        this.setupSocketListeners();
    }

    // Setup chat panel UI
    setupChatPanel() {
        const chatPanel = `
            <div class="chat-panel" id="chatPanel">
                <div class="chat-header">
                    <h4>Chat</h4>
                    <button class="minimize-btn" onclick="toggleChatPanel()">−</button>
                </div>
                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-input">
                    <textarea id="messageInput" placeholder="Type a message..."></textarea>
                    <button onclick="sendMessage()">Send</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', chatPanel);

        // Add enter key listener for sending messages
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    // Send a message
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content || !this.activeChat) return;

        try {
            // Emit message through socket
            window.socketService.socket.emit('sendMessage', {
                chatId: this.activeChat,
                content: content
            });

            // Clear input
            input.value = '';
        } catch (error) {
            console.error('Send message error:', error);
            alert('Failed to send message');
        }
    }

    // Setup WebSocket listeners for chat
    setupSocketListeners() {
        window.socketService.socket.on('newMessage', (data) => {
            this.handleNewMessage(data);
        });

        window.socketService.socket.on('messageRead', (data) => {
            this.updateMessageReadStatus(data);
        });
    }

    // Handle incoming message
    handleNewMessage(data) {
        if (data.chatId === this.activeChat) {
            this.appendMessage(data);
            this.markMessagesAsRead();
        } else {
            // Update unread count for inactive chat
            const count = this.unreadMessages.get(data.chatId) || 0;
            this.unreadMessages.set(data.chatId, count + 1);
            this.updateUnreadBadge(data.chatId);
        }
    }

    // Append new message to chat
    appendMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const currentUserId = localStorage.getItem('userId');
        
        const messageElement = `
            <div class="message ${message.sender._id === currentUserId ? 'sent' : 'received'}">
                <div class="message-content">
                    ${message.content}
                    <span class="message-time">
                        ${new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    <span class="read-status">✓</span>
                </div>
            </div>
        `;

        chatMessages.insertAdjacentHTML('beforeend', messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Mark messages as read
    async markMessagesAsRead() {
        if (!this.activeChat) return;
        
        try {
            window.socketService.socket.emit('markMessagesRead', {
                chatId: this.activeChat
            });
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }
}

// Initialize the service
window.chatService = new ChatService();

// Helper functions
function toggleChatPanel() {
    document.getElementById('chatPanel').classList.toggle('minimized');
}

function sendMessage() {
    window.chatService.sendMessage();
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatService.init();
});