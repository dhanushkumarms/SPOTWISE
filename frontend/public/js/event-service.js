/**
 * SpotWise Event Service
 * Handles real-time Server-Sent Events (SSE) for the SpotWise application
 */

class EventService {
    constructor() {
        this.eventSource = null;
        this.reconnectTimeout = 5000; // 5 seconds initial timeout
        this.maxReconnectTimeout = 60000; // Maximum timeout of 60 seconds
        this.currentReconnectTimeout = this.reconnectTimeout;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10; // Maximum number of reconnect attempts
        this.eventListeners = new Map();
        this.isConnected = false;
        this.token = null;
        this.userId = null;
        this.userRole = null;
        this.connectionErrorShown = false;
    }

    /**
     * Initialize the event service
     */
    init() {
        try {
            this.token = localStorage.getItem('token');
            this.userId = localStorage.getItem('userId');
            this.userRole = localStorage.getItem('userRole');
            
            if (!this.token) {
                console.warn('No authentication token found, skipping event service initialization');
                return;
            }
            
            this.connect();
            
            // Set up ping interval to keep the connection alive
            this.setupPingInterval();
            
            // Set up window events for better connection management
            this.setupWindowEvents();
        } catch (error) {
            console.error('Error initializing event service:', error);
        }
    }

    /**
     * Connect to the SSE endpoint
     */
    connect() {
        // Close existing connection if any
        this.disconnect();

        try {
            // Create new EventSource connection with retry parameter
            const url = new URL('http://localhost:3000/api/events');
            url.searchParams.append('token', this.token);
            url.searchParams.append('retry', this.currentReconnectTimeout);
            
            this.eventSource = new EventSource(url.toString());

            this.eventSource.onopen = () => {
                console.log('EventSource connection established');
                this.isConnected = true;
                this.connectionErrorShown = false;
                this.reconnectAttempts = 0;
                this.currentReconnectTimeout = this.reconnectTimeout; // Reset timeout on successful connection
                
                // Dispatch a connection event that other parts of the app can listen for
                this.dispatchEvent('connected', { userId: this.userId, timestamp: new Date() });
            };

            // Handle general connection error
            this.eventSource.onerror = (error) => {
                this.handleConnectionError(error);
            };

            // Set up default event listeners
            this.setupDefaultEventListeners();
            
        } catch (error) {
            console.error('Failed to initialize event source:', error);
            this.isConnected = false;
            
            // Show error only once
            if (!this.connectionErrorShown) {
                this.connectionErrorShown = true;
                if (window.errorHandler) {
                    window.errorHandler.showAlert(
                        'Connection Error',
                        'Failed to establish real-time connection. Some features may be limited. Retrying...',
                        'warning'
                    );
                }
            }
            
            // Try to reconnect after a delay
            this.scheduleReconnect();
        }
    }

    /**
     * Handle connection errors with exponential backoff
     */
    handleConnectionError(error) {
        console.error('EventSource error:', error);
        this.isConnected = false;
        
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        // Implement exponential backoff for reconnection
        this.scheduleReconnect();
        
        // Show error only once per disconnection
        if (!this.connectionErrorShown) {
            this.connectionErrorShown = true;
            if (window.errorHandler) {
                window.errorHandler.showAlert(
                    'Connection Error',
                    'Lost connection to the server. Attempting to reconnect...',
                    'warning'
                );
            }
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        
        // Check if we've reached the maximum number of attempts
        if (this.maxReconnectAttempts && this.reconnectAttempts > this.maxReconnectAttempts) {
            console.error('Maximum reconnection attempts reached');
            if (window.errorHandler) {
                window.errorHandler.showAlert(
                    'Connection Failed',
                    'Failed to establish connection after multiple attempts. Please refresh the page.',
                    'error'
                );
            }
            return;
        }
        
        // Calculate exponential backoff with jitter
        const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
        this.currentReconnectTimeout = Math.min(
            this.currentReconnectTimeout * 1.5 * jitter, 
            this.maxReconnectTimeout
        );
        
        console.log(`Reconnecting in ${Math.round(this.currentReconnectTimeout / 1000)} seconds...`);
        
        setTimeout(() => this.connect(), this.currentReconnectTimeout);
    }

    /**
     * Disconnect from the SSE endpoint
     */
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.isConnected = false;
        }
    }

    /**
     * Setup default event listeners
     */
    setupDefaultEventListeners() {
        try {
            if (!this.eventSource) return;

            // Listen for connection established event
            this.eventSource.addEventListener('connected', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Connected event received:', data);
                    
                    // Reset error state since we're connected
                    this.connectionErrorShown = false;
                } catch (error) {
                    console.error('Error parsing connected event data:', error);
                }
            });

            // Listen for request updates
            this.eventSource.addEventListener('requestUpdated', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Request updated:', data);
                    
                    // Trigger any registered callbacks
                    this.dispatchEvent('requestUpdated', data);
                } catch (error) {
                    console.error('Error parsing requestUpdated event data:', error);
                }
            });

            // Listen for error events from server
            this.eventSource.addEventListener('error', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.error('Server sent error event:', data);
                    
                    if (window.errorHandler) {
                        window.errorHandler.showAlert(
                            'Server Error', 
                            data.message || 'An error occurred on the server', 
                            'error'
                        );
                    }
                } catch (error) {
                    console.error('Error parsing error event:', error);
                }
            });
            
            // Listen for auth errors
            this.eventSource.addEventListener('authError', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.error('Authentication error from server:', data);
                    
                    if (window.errorHandler) {
                        window.errorHandler.handleAuthError(
                            data.message || 'Your session is invalid or expired'
                        );
                    }
                } catch (error) {
                    console.error('Error parsing authError event:', error);
                    
                    // Fall back to default auth error handling
                    if (window.errorHandler) {
                        window.errorHandler.handleAuthError('Session error');
                    }
                }
            });

        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    /**
     * Dispatch event to registered listeners
     * @param {string} event - The event name
     * @param {object} data - The event data
     */
    dispatchEvent(event, data) {
        if (this.eventListeners.has(event)) {
            const callbacks = this.eventListeners.get(event);
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} event listener:`, error);
                }
            });
        }
    }

    /**
     * Register an event listener
     * @param {string} event - The event name
     * @param {function} callback - The callback function
     * @returns {function} - Function to remove the listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        
        this.eventListeners.get(event).add(callback);
        
        // Return a function to remove the listener
        return () => {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }

    /**
     * Force reconnection to the SSE endpoint
     */
    reconnect() {
        this.disconnect();
        this.connect();
    }

    /**
     * Set up ping interval to keep connection alive
     */
    setupPingInterval() {
        // Send a ping every 30 seconds to keep the connection alive
        setInterval(() => {
            if (this.isConnected) {
                try {
                    // Simple ping to the server
                    fetch('http://localhost:3000/api/ping', {
                        headers: {
                            'Authorization': `Bearer ${this.token}`
                        }
                    }).catch(error => {
                        console.warn('Ping error:', error);
                        // Don't handle ping errors aggressively
                    });
                } catch (error) {
                    console.warn('Error sending ping:', error);
                }
            }
        }, 30000); // 30 seconds
    }

    /**
     * Set up window events for better connection management
     */
    setupWindowEvents() {
        // Reconnect when the page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (!this.isConnected) {
                    console.log('Page became visible. Reconnecting...');
                    this.reconnect();
                }
            }
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            console.log('Browser went online. Reconnecting...');
            this.reconnect();
        });

        window.addEventListener('offline', () => {
            console.log('Browser went offline. Disconnecting...');
            this.disconnect();
            
            if (window.errorHandler) {
                window.errorHandler.showAlert(
                    'Connection Lost',
                    'You are currently offline. Please check your internet connection.',
                    'warning'
                );
            }
        });
    }

    // Add helper method to get user information
    getUserInfo() {
        return {
            userId: this.userId,
            userRole: this.userRole,
            isConnected: this.isConnected
        };
    }
}

// Initialize the event service
window.eventService = new EventService();

// Connect when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize after a small delay to ensure all other scripts are loaded
    setTimeout(() => {
        try {
            window.eventService.init();
        } catch (error) {
            console.error('Error initializing event service:', error);
            if (window.errorHandler) {
                window.errorHandler.showAlert(
                    'Initialization Error',
                    'Failed to initialize real-time services. Some features may be limited.',
                    'warning'
                );
            }
        }
    }, 1000);
});
