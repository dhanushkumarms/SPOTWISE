// Authentication script for all pages

// Define the backend API base URL
const API_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://backend-green-zeta-69.vercel.app';
// Update profile dropdown with username if available
function updateProfileDropdown() {
    const profileIcon = document.querySelector('.profile-icon');
    const userName = localStorage.getItem('userName');
    
    if (profileIcon && userName) {
        // Add username to profile icon tooltip if not already there
        if (!profileIcon.getAttribute('title')) {
            profileIcon.setAttribute('title', `Logged in as ${userName}`);
        }
    }
}

// Function to handle login
async function login(email, password) {
    try {
        // Validate inputs
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        
        if (!email.includes('@')) {
            throw new Error('Please enter a valid email address');
        }

        // Show loading state if UI elements exist
        const loginButton = document.querySelector('#loginForm button[type="submit"]');
        if (loginButton) {
            loginButton.disabled = true;
            loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
        }

        const response = await window.fetchWithErrorHandling(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        // Store auth data in localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('userName', data.userName);
        localStorage.setItem('userRole', data.role);
        
        // If user is a provider, set their status to online
        if (data.role === 'provider') {
            // Update provider status to online in backend
            await updateProviderStatusOnLogin('online');
        }
        
        // Update UI based on login state
        updateAuthUI(true);
        
        return true;
    } catch (error) {
        // Use our error handler to show the error
        window.errorHandler.showAlert('Login Failed', error.message, 'error');
        throw error;
    } finally {
        // Reset login button state if it exists
        const loginButton = document.querySelector('#loginForm button[type="submit"]');
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    }
}

// Function to handle logout
function logout() {
    try {
        // If user is a provider, set their status to offline before clearing localStorage
        const userRole = localStorage.getItem('userRole');
        const token = localStorage.getItem('token');
        
        if (userRole === 'provider' && token) {
            // Update provider status to offline in backend
            updateProviderStatusOnLogout('offline');
        }
        
        // Clear localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('providerStatus');
        
        // Update UI based on logout state
        updateAuthUI(false);
        
        // Show success message
        window.errorHandler.showAlert('Logged Out', 'You have been successfully logged out.', 'success');
        
        // Redirect to home page if not already there
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error during logout:', error);
        // Even if there's an error, still clear local storage and redirect
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// Update provider status on login
async function updateProviderStatusOnLogin(status) {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await window.fetchWithErrorHandling(`${API_BASE_URL}/api/users/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        
        // Update localStorage with the new status
        localStorage.setItem('providerStatus', status);
        
    } catch (error) {
        console.error('Error updating provider status on login:', error);
        // Don't block the login process for this error, just log it
        // We'll still set the status locally
        localStorage.setItem('providerStatus', status);
    }
}

// Update provider status on logout (using synchronous XHR to ensure it completes before page unload)
function updateProviderStatusOnLogout(status) {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        // First try using asynchronous fetch with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        fetch(`${API_BASE_URL}/api/users/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status }),
            signal: controller.signal
        }).then(() => clearTimeout(timeoutId))
          .catch(() => {
            // If async fetch fails, fallback to synchronous XHR
            const xhr = new XMLHttpRequest();
            xhr.open('PATCH', `${API_BASE_URL}/api/users/status`, false); // false = synchronous
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            
            try {
                xhr.send(JSON.stringify({ status }));
            } catch (e) {
                console.error('Error updating provider status on logout:', e);
            }
        });
    } catch (error) {
        console.error('Error updating provider status on logout:', error);
    }
}

// Fetch provider status from backend with enhanced error handling
async function fetchProviderStatus() {
    try {
        const userRole = localStorage.getItem('userRole');
        const token = localStorage.getItem('token');
        
        if (userRole !== 'provider' || !token) return;
        
        const response = await window.fetchWithErrorHandling(`${API_BASE_URL}/api/users/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        // Update localStorage with the fetched status
        if (data.status) {
            localStorage.setItem('providerStatus', data.status);
        }
        
        return data.status;
    } catch (error) {
        console.error('Error fetching provider status:', error);
        // Return the cached status if we have one
        return localStorage.getItem('providerStatus');
    }
}

// Function to update UI based on authentication state
function updateAuthUI(isLoggedIn) {
    const loginBtn = document.getElementById('loginBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    
    if (!loginBtn || !profileDropdown) return;
    
    if (isLoggedIn) {
        loginBtn.style.display = 'none';
        profileDropdown.style.display = 'block';
        updateProfileDropdown();
    } else {
        loginBtn.style.display = 'block';
        profileDropdown.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    try {
        // Check if user is logged in (token exists in localStorage)
        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('userRole');
        const userId = localStorage.getItem('userId');
        
        // Validate token - could add JWT validation logic here
        
        // Update UI
        updateAuthUI(!!token);
        
        // Handle logout functionality
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                logout();
            });
        }
        
        // Fetch provider status if logged in as provider
        if (token && localStorage.getItem('userRole') === 'provider') {
            fetchProviderStatus().then(status => {
                // If there are UI elements that need to reflect this status, update them here
                if (typeof updateStatusUI === 'function' && status) {
                    updateStatusUI(status);
                }
            });
        }
        
        // Check token expiration
        if (token) {
            checkTokenExpiration(token);
        }
    } catch (error) {
        console.error('Error in auth initialization:', error);
        // If there's a critical error in auth initialization, clear storage and redirect to login
        localStorage.clear();
        if (window.location.pathname !== '/login.html') {
            window.location.href = 'login.html';
        }
    }
});

// Function to check if the token is expired
function checkTokenExpiration(token) {
    try {
        // JWT tokens are in format: header.payload.signature
        // We need to decode the payload to check expiration
        const payload = token.split('.')[1];
        if (!payload) return;
        
        // Decode the base64 string
        const decodedPayload = JSON.parse(atob(payload));
        
        // Check if token has expiration
        if (decodedPayload.exp) {
            const expirationTime = decodedPayload.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            
            // If token is expired or about to expire in 5 minutes
            if (expirationTime < currentTime + 5 * 60 * 1000) {
                // Token is expired or about to expire
                if (expirationTime < currentTime) {
                    // Already expired
                    window.errorHandler.showAlert(
                        'Session Expired', 
                        'Your session has expired. Please log in again.', 
                        'warning'
                    );
                    logout();
                } else {
                    // About to expire, show warning
                    window.errorHandler.showAlert(
                        'Session Expiring Soon', 
                        'Your session will expire soon. Please save your work and log in again.',
                        'warning'
                    );
                    
                    // Could add silent token refresh here
                }
            }
        }
    } catch (error) {
        console.warn('Error checking token expiration:', error);
        // Don't logout user just for failed expiration check
    }
}
