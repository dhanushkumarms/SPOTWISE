/**
 * SPOTWISE UI Notifications
 * Enhanced notification system for better user feedback
 */

class UINotifications {
    constructor() {
        this.container = null;
        this.defaultDuration = 5000; // 5 seconds
        this.maxNotifications = 3;
        this.notificationCount = 0;
        
        this.initContainer();
        
        // Listen for DOM content loaded to handle existing notifications
        document.addEventListener('DOMContentLoaded', () => {
            this.handleExistingNotifications();
        });
    }
    
    /**
     * Initialize the notification container
     */
    initContainer() {
        // Check if container already exists
        let container = document.querySelector('.notification-container');
        
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        this.container = container;
        return container;
    }
    
    /**
     * Show a notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     */
    show(title, message, type = 'info', duration = this.defaultDuration) {
        // Ensure container exists
        if (!this.container) this.initContainer();
        
        // Limit the number of notifications
        if (this.notificationCount >= this.maxNotifications) {
            const firstNotification = this.container.querySelector('.notification');
            if (firstNotification) {
                firstNotification.remove();
                this.notificationCount--;
            }
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Create the HTML structure
        notification.innerHTML = `
            <div class="notification-icon">
                ${this.getIconForType(type)}
            </div>
            <div class="notification-content">
                <h4 class="notification-title">${title}</h4>
                <p class="notification-message">${message}</p>
            </div>
            <button class="notification-close" aria-label="Close notification">&times;</button>
        `;
        
        // Add to container
        this.container.appendChild(notification);
        this.notificationCount++;
        
        // Add dismissal functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.dismiss(notification));
        
        // Use RAF to ensure proper animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Auto dismiss after duration (if not 0)
        if (duration) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }
        
        // Return the notification for reference
        return notification;
    }
    
    /**
     * Dismiss a notification
     * @param {HTMLElement} notification - The notification element to dismiss
     */
    dismiss(notification) {
        // Remove the show class to trigger the exit animation
        notification.classList.remove('show');
        
        // Wait for animation to complete before removing from DOM
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
                this.notificationCount--;
            }
        }, 300);
    }
    
    /**
     * Show success notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {number} duration - Duration in milliseconds
     */
    success(title, message, duration = this.defaultDuration) {
        return this.show(title, message, 'success', duration);
    }
    
    /**
     * Show error notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {number} duration - Duration in milliseconds
     */
    error(title, message, duration = this.defaultDuration) {
        return this.show(title, message, 'error', duration);
    }
    
    /**
     * Show warning notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {number} duration - Duration in milliseconds
     */
    warning(title, message, duration = this.defaultDuration) {
        return this.show(title, message, 'warning', duration);
    }
    
    /**
     * Show info notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {number} duration - Duration in milliseconds
     */
    info(title, message, duration = this.defaultDuration) {
        return this.show(title, message, 'info', duration);
    }
    
    /**
     * Get the icon HTML for a notification type
     * @param {string} type - Notification type
     * @returns {string} - HTML for the icon
     */
    getIconForType(type) {
        switch (type) {
            case 'success':
                return '<i class="fa fa-check-circle"></i>';
            case 'error':
                return '<i class="fa fa-times-circle"></i>';
            case 'warning':
                return '<i class="fa fa-exclamation-triangle"></i>';
            case 'info':
            default:
                return '<i class="fa fa-info-circle"></i>';
        }
    }
    
    /**
     * Handle any existing alert messages and convert them to notifications
     */
    handleExistingNotifications() {
        // Handle bootstrap alerts
        const alerts = document.querySelectorAll('.alert:not(.processed)');
        alerts.forEach(alert => {
            // Extract content
            const title = alert.querySelector('strong')?.textContent || '';
            const message = alert.textContent.replace(title, '').trim();
            
            // Determine type
            let type = 'info';
            if (alert.classList.contains('alert-success')) type = 'success';
            if (alert.classList.contains('alert-danger')) type = 'error';
            if (alert.classList.contains('alert-warning')) type = 'warning';
            
            // Show as notification
            this.show(title, message, type);
            
            // Mark as processed
            alert.classList.add('processed');
            
            // Remove or hide the original alert
            if (!alert.dataset.keepOriginal) {
                alert.style.display = 'none';
            }
        });
    }
}

// Initialize global instance
window.notifications = new UINotifications();

// Hook into the error handler for integration
if (window.errorHandler) {
    const originalShowAlert = window.errorHandler.showAlert;
    window.errorHandler.showAlert = function(title, message, type) {
        // Map error handler types to notification types
        const notificationType = type === 'success' ? 'success' : 
                               type === 'error' || type === 'danger' ? 'error' :
                               type === 'warning' ? 'warning' : 'info';
        
        // Show notification
        window.notifications.show(title, message, notificationType);
        
        // Still call original method for compatibility
        if (originalShowAlert) {
            originalShowAlert.call(window.errorHandler, title, message, type);
        }
    };
}
