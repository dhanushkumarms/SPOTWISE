/**
 * SpotWise Error Handler
 * Provides centralized error handling functionality for the application
 */

class ErrorHandler {
    constructor() {
        this.defaultNetworkErrorMessage = "Network error. Please check your connection and try again.";
        this.defaultAuthErrorMessage = "Authentication error. Please log in again.";
        this.defaultServerErrorMessage = "The server encountered an error. Please try again later.";
        this.defaultInputErrorMessage = "Please check your input and try again.";
    }

    /**
     * Handle fetch response errors
     * @param {Response} response - Fetch API response object
     * @returns {Promise} - Rejects with appropriate error or continues
     */
    async handleFetchResponse(response) {
        if (!response.ok) {
            // Try to parse error message from response
            try {
                const errorData = await response.json();
                
                // Special handling for authentication errors
                if (response.status === 401 || response.status === 403) {
                    this.handleAuthError(errorData.message || this.defaultAuthErrorMessage);
                    throw new Error(errorData.message || this.defaultAuthErrorMessage);
                }
                
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            } catch (parseError) {
                // If response parsing fails, throw a generic error based on status
                if (response.status === 401 || response.status === 403) {
                    this.handleAuthError(this.defaultAuthErrorMessage);
                    throw new Error(this.defaultAuthErrorMessage);
                } else if (response.status >= 500) {
                    throw new Error(this.defaultServerErrorMessage);
                } else {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
            }
        }
        return response;
    }

    /**
     * Handle network errors from fetch
     * @param {Error} error - The error from a fetch call
     * @param {object} options - Options for handling the error
     * @returns {Error} - Enhanced error with more context
     */
    handleFetchError(error, options = {}) {
        console.error('Network request error:', error);
        
        // Detect if this is a network connectivity error
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            return new Error(this.defaultNetworkErrorMessage);
        }
        
        // Return the original error if it's already been processed
        return error;
    }

    /**
     * Handle authentication errors
     * @param {string} message - Error message
     */
    handleAuthError(message) {
        console.warn('Authentication error:', message);
        
        // Show an alert to the user
        this.showAlert('Authentication Error', message || this.defaultAuthErrorMessage, 'error');
        
        // Clear auth data after a short delay to allow alert to be seen
        setTimeout(() => {
            // Clear authentication data
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('userRole');
            localStorage.removeItem('providerStatus');
            
            // Redirect to login page
            window.location.href = 'login.html';
        }, 2000);
    }

    /**
     * Validate form inputs
     * @param {HTMLFormElement} form - The form to validate
     * @param {object} customValidators - Custom validation functions
     * @returns {boolean} - True if valid, false otherwise
     */
    validateForm(form, customValidators = {}) {
        // First use browser's built-in validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }
        
        // Then apply custom validators if provided
        for (const [fieldName, validator] of Object.entries(customValidators)) {
            const field = form.elements[fieldName];
            if (!field) continue;
            
            const errorMessage = validator(field.value, form);
            if (errorMessage) {
                this.showInputError(field, errorMessage);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Show input error
     * @param {HTMLElement} inputElement - The input element with error
     * @param {string} message - Error message
     */
    showInputError(inputElement, message) {
        // Remove any existing error message
        const existingError = inputElement.parentNode.querySelector('.error-message');
        if (existingError) existingError.remove();
        
        // Create and append error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message text-danger small mt-1';
        errorDiv.textContent = message;
        
        // Add error class to input
        inputElement.classList.add('is-invalid');
        
        // Insert error after input
        inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
        
        // Focus the input
        inputElement.focus();
        
        // Remove error when input changes
        const clearError = () => {
            inputElement.classList.remove('is-invalid');
            const errorMsg = inputElement.parentNode.querySelector('.error-message');
            if (errorMsg) errorMsg.remove();
            
            // Remove these event listeners
            inputElement.removeEventListener('input', clearError);
            inputElement.removeEventListener('change', clearError);
        };
        
        inputElement.addEventListener('input', clearError);
        inputElement.addEventListener('change', clearError);
    }

    /**
     * Show alert message
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     * @param {string} type - Alert type (success, error, warning, info)
     */
    showAlert(title, message, type = 'error') {
        // Use SweetAlert2 if available
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                text: message,
                icon: type,
                confirmButtonText: 'OK'
            });
        } 
        // Fallback to Bootstrap alerts
        else {
            const alertContainer = document.getElementById('alertContainer') || this.createAlertContainer();
            
            // Create the alert element
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${this.mapAlertType(type)} alert-dismissible fade show`;
            alertDiv.setAttribute('role', 'alert');
            
            // Set the content
            alertDiv.innerHTML = `
                <strong>${title}</strong> ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            `;
            
            // Add to container
            alertContainer.prepend(alertDiv);
            
            // Auto dismiss after 5 seconds
            setTimeout(() => {
                alertDiv.classList.remove('show');
                setTimeout(() => alertDiv.remove(), 150);
            }, 5000);
        }
    }
    
    /**
     * Map alert type to Bootstrap alert class
     * @param {string} type - Alert type (success, error, warning, info)
     * @returns {string} - Bootstrap alert class
     */
    mapAlertType(type) {
        const typeMap = {
            'error': 'danger',
            'success': 'success',
            'warning': 'warning',
            'info': 'info'
        };
        return typeMap[type] || 'info';
    }
    
    /**
     * Create alert container if it doesn't exist
     * @returns {HTMLDivElement} - Alert container element
     */
    createAlertContainer() {
        const existingContainer = document.getElementById('alertContainer');
        if (existingContainer) return existingContainer;
        
        const container = document.createElement('div');
        container.id = 'alertContainer';
        container.className = 'alert-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.maxWidth = '400px';
        container.style.zIndex = '9999';
        
        document.body.appendChild(container);
        return container;
    }
    
    /**
     * Handle unexpected exceptions
     * @param {Error} error - The error object
     * @param {string} context - Context where the error occurred
     */
    handleException(error, context = '') {
        console.error(`Exception in ${context}:`, error);
        
        // Show user-friendly message
        this.showAlert(
            'Unexpected Error', 
            'An unexpected error occurred. Please try again or contact support if the problem persists.', 
            'error'
        );
        
        // Here you could also log to a monitoring service like Sentry
        // if (typeof Sentry !== 'undefined') {
        //     Sentry.captureException(error);
        // }
    }
}

// Create a global instance
window.errorHandler = new ErrorHandler();

// Set up global error handling for uncaught exceptions
window.addEventListener('error', (event) => {
    window.errorHandler.handleException(event.error, 'Uncaught exception');
    // Don't prevent default to allow browser console error reporting
});

// Set up global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    window.errorHandler.handleException(event.reason, 'Unhandled promise rejection');
    // Don't prevent default to allow browser console error reporting
});

// Enhanced fetch function with automatic error handling
window.fetchWithErrorHandling = async (url, options = {}) => {
    try {
        const response = await fetch(url, options);
        await window.errorHandler.handleFetchResponse(response);
        return response;
    } catch (error) {
        const enhancedError = window.errorHandler.handleFetchError(error, options);
        throw enhancedError;
    }
};
