class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.initialReconnectDelay = 1000; // Start with 1 second
        this.currentReconnectDelay = this.initialReconnectDelay;
        this.maxReconnectDelay = 30000; // Max 30 seconds between attempts
        this.reconnectTimerId = null;
        this.serverUrl = 'http://localhost:5000'; // Store server URL for reconnection
        this.listeners = new Map(); // Store event listeners for reconnection
        this.pendingMessages = []; // Store messages that couldn't be sent while disconnected
        this.connectionErrorShown = false;
    }

    connect() {
        try {
            // Clear any existing reconnection timers
            if (this.reconnectTimerId) {
                clearTimeout(this.reconnectTimerId);
                this.reconnectTimerId = null;
            }

            // Get authentication token if available
            const token = localStorage.getItem('token');

            // Create socket connection with auth token if available
            this.socket = io(this.serverUrl, {
                auth: token ? { token } : undefined,
                reconnection: false, // We'll handle reconnection ourselves
                timeout: 10000, // 10 second connection timeout
            });

            // Set up event listeners
            this.setupConnectionEventListeners();
            this.setupEventListeners();
            
            console.log('Attempting to connect to WebSocket server');
        } catch (error) {
            console.error('Error initializing WebSocket connection:', error);
            this.handleConnectionError(error);
        }
    }

    setupConnectionEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            this.handleSuccessfulConnection();
        });

        this.socket.on('disconnect', (reason) => {
            this.handleDisconnection(reason);
        });

        this.socket.on('connect_error', (error) => {
            this.handleConnectionError(error);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            
            // Check if this is an authentication error
            if (error.type === 'AuthError' || error.message?.includes('auth')) {
                this.handleAuthError(error);
            } else {
                this.notifyError('Connection Error', error.message || 'WebSocket error occurred');
            }
        });
    }

    handleSuccessfulConnection() {
        this.connected = true;
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        this.currentReconnectDelay = this.initialReconnectDelay;
        this.connectionErrorShown = false;
        
        console.log('Connected to WebSocket server');
        
        // Resend any pending messages
        this.sendPendingMessages();
    }

    handleDisconnection(reason) {
        this.connected = false;
        console.log('Disconnected from WebSocket server:', reason);

        // Don't attempt to reconnect if the disconnection was intentional
        const intentionalDisconnects = ['io client disconnect', 'io server disconnect'];
        if (!intentionalDisconnects.includes(reason)) {
            this.scheduleReconnect();
        }
    }

    handleConnectionError(error) {
        this.connected = false;
        console.error('WebSocket connection error:', error);

        // Show error notification if we haven't already
        if (!this.connectionErrorShown) {
            this.connectionErrorShown = true;
            this.notifyError(
                'Connection Error',
                'Could not connect to real-time service. Some features may be limited.'
            );
        }

        this.scheduleReconnect();
    }

    handleAuthError(error) {
        console.error('Socket authentication error:', error);
        
        // Notify the user
        if (window.errorHandler) {
            window.errorHandler.handleAuthError('Your session has expired or is invalid');
        } else {
            this.notifyError('Authentication Error', 'Please log in again');
            
            // If error handler is not available, handle basic logout
            setTimeout(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('userName');
                localStorage.removeItem('userRole');
                window.location.href = 'login.html';
            }, 2000);
        }
        
        // Don't attempt to reconnect with invalid auth
        if (this.reconnectTimerId) {
            clearTimeout(this.reconnectTimerId);
            this.reconnectTimerId = null;
        }
    }

    scheduleReconnect() {
        if (this.reconnecting) return; // Already in reconnection process
        
        this.reconnecting = true;
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
            console.error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
            this.notifyError(
                'Connection Failed',
                `Failed to reconnect to the server after ${this.maxReconnectAttempts} attempts. Please refresh the page.`
            );
            return;
        }
        
        // Implement exponential backoff with jitter
        const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
        this.currentReconnectDelay = Math.min(
            this.currentReconnectDelay * 1.5 * jitter,
            this.maxReconnectDelay
        );
        
        console.log(`Attempting to reconnect in ${Math.round(this.currentReconnectDelay / 1000)} seconds (attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts})`);
        
        this.reconnectTimerId = setTimeout(() => {
            this.reconnectTimerId = null;
            this.connect();
        }, this.currentReconnectDelay);
    }

    setupEventListeners() {
        if (!this.socket) return;

        // Store listener references for potential reconnection
        this.addListener('providerLocationUpdated', (data) => {
            try {
                updateProviderMarker(data.providerId, data.location);
            } catch (error) {
                console.error('Error handling providerLocationUpdated event:', error);
            }
        });

        // Add new event for nearby providers
        this.addListener('nearbyProvidersUpdate', (data) => {
            try {
                if (window.mapService && Array.isArray(data.providers)) {
                    // Clear existing provider markers except your own
                    window.mapService.clearProviderMarkers();
                    
                    // Add markers for each nearby provider
                    data.providers.forEach(provider => {
                        if (provider.location && provider.location.coordinates) {
                            const position = {
                                lat: provider.location.coordinates[1],
                                lng: provider.location.coordinates[0]
                            };
                            
                            window.mapService.updateProviderMarker(provider._id, position, {
                                name: provider.name || 'Service Provider',
                                service: provider.skills ? provider.skills.join(', ') : 'General Service',
                                rating: provider.rating || '4.5',
                                distance: provider.distance ? `${(provider.distance / 1000).toFixed(1)} km away` : 'Nearby'
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Error handling nearbyProvidersUpdate event:', error);
            }
        });

        this.addListener('requestUpdated', (request) => {
            try {
                updateRequestStatus(request);
            } catch (error) {
                console.error('Error handling requestUpdated event:', error);
            }
        });

        this.addListener('newRequestNotification', (data) => {
            try {
                showNotification('New Request', data.message);
            } catch (error) {
                console.error('Error handling newRequestNotification event:', error);
            }
        });

        // Chat events
        this.addListener('newMessage', (data) => {
            try {
                if (window.chatService) {
                    window.chatService.handleNewMessage(data);
                }
            } catch (error) {
                console.error('Error handling newMessage event:', error);
            }
        });

        this.addListener('messageRead', (data) => {
            try {
                if (window.chatService) {
                    window.chatService.updateMessageReadStatus(data);
                }
            } catch (error) {
                console.error('Error handling messageRead event:', error);
            }
        });

        // Handle server-side errors
        this.addListener('serverError', (error) => {
            console.error('Server error:', error);
            this.notifyError('Server Error', error.message || 'An error occurred on the server');
        });
    }

    addListener(event, callback) {
        if (!this.socket) return;

        // Store listener reference
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        
        // Add the actual socket listener
        this.socket.on(event, callback);
    }

    // Send location update with error handling
    updateLocation(location) {
        this.emitWithErrorHandling('updateLocation', {
            providerId: getCurrentUserId(),
            location: location
        });
    }

    // Request nearby providers
    requestNearbyProviders(location, radius = 5000) {
        this.emitWithErrorHandling('findNearbyProviders', {
            location: location,
            radius: radius // in meters
        });
    }

    // Update request status with error handling
    updateRequestStatus(requestId, status) {
        this.emitWithErrorHandling('requestStatusUpdate', {
            requestId,
            status,
            providerId: getCurrentUserId()
        });
    }

    // Emit with error handling and queuing for disconnection
    emitWithErrorHandling(event, data, callback) {
        if (!this.socket || !this.connected) {
            console.warn(`Socket not connected. Queuing '${event}' message for later`);
            // Queue message to send when reconnected
            this.pendingMessages.push({ event, data, callback });
            return false;
        }

        try {
            if (callback) {
                this.socket.emit(event, data, (response) => {
                    try {
                        callback(response);
                    } catch (callbackError) {
                        console.error(`Error in ${event} callback:`, callbackError);
                    }
                });
            } else {
                this.socket.emit(event, data);
            }
            return true;
        } catch (error) {
            console.error(`Error emitting ${event}:`, error);
            return false;
        }
    }

    // Process pending messages after reconnection
    sendPendingMessages() {
        if (this.pendingMessages.length === 0) return;
        
        console.log(`Sending ${this.pendingMessages.length} pending messages`);
        
        // Create a copy of the queue and clear the original
        const messagesToSend = [...this.pendingMessages];
        this.pendingMessages = [];
        
        // Send each message
        messagesToSend.forEach(msg => {
            this.emitWithErrorHandling(msg.event, msg.data, msg.callback);
        });
    }

    // Gracefully disconnect
    disconnect() {
        if (this.socket) {
            console.log('Disconnecting from WebSocket server');
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.connected = false;
        
        // Clear any reconnection attempts
        if (this.reconnectTimerId) {
            clearTimeout(this.reconnectTimerId);
            this.reconnectTimerId = null;
        }
    }

    // Notify user of errors using the error handler if available
    notifyError(title, message) {
        if (window.errorHandler) {
            window.errorHandler.showAlert(title, message, 'error');
        } else {
            console.error(`${title}: ${message}`);
            // Fallback to alert for critical errors
            if (title.includes('Authentication') || title.includes('Failed')) {
                alert(`${title}: ${message}`);
            }
        }
    }
}

// Helper function to get current user ID
function getCurrentUserId() {
    return localStorage.getItem('userId') || null;
}

// Helper functions for updating UI
function updateProviderMarker(providerId, location) {
    try {
        // Don't update your own marker from server updates if you're tracking locally
        const isOwnMarker = providerId === localStorage.getItem('userId');
        const isTracking = localStorage.getItem('locationTrackingEnabled') === 'true';
        
        if (isOwnMarker && isTracking) {
            return; // Skip - we're already updating this locally
        }
        
        // Update provider marker on the map
        if (window.mapService) {
            window.mapService.updateProviderMarker(providerId, location);
        }
    } catch (error) {
        console.error('Error updating provider marker:', error);
    }
}

function updateRequestStatus(request) {
    try {
        // Update UI elements showing request status
        const statusElement = document.getElementById(`request-${request._id}-status`);
        if (statusElement) {
            statusElement.textContent = request.status;
            statusElement.className = `status-${request.status}`;
        }
        
        // Dispatch a custom event for other components
        const requestEvent = new CustomEvent('requestStatusChanged', { 
            detail: request 
        });
        document.dispatchEvent(requestEvent);
    } catch (error) {
        console.error('Error updating request status:', error);
    }
}

function showNotification(title, message) {
    try {
        // Use error handler if available
        if (window.errorHandler) {
            window.errorHandler.showAlert(title, message, 'info');
            return;
        }
        
        // Fallback to browser notification
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body: message });
                }
            });
        }
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

// Initialize the socket service
document.addEventListener('DOMContentLoaded', () => {
    // Initialize after a small delay to ensure authentication is loaded
    setTimeout(() => {
        try {
            if (!window.socketService) {
                window.socketService = new SocketService();
                
                // Only connect if user is authenticated
                if (localStorage.getItem('token')) {
                    window.socketService.connect();
                }
            }
        } catch (error) {
            console.error('Error initializing socket service:', error);
            if (window.errorHandler) {
                window.errorHandler.showAlert(
                    'Initialization Error',
                    'Failed to initialize real-time connection. Some features may be limited.',
                    'warning'
                );
            }
        }
    }, 1500);
});