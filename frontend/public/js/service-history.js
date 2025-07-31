/**
 * SpotWise Service History
 * Handles the display and management of past service requests
 */

document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
    loadServiceHistory();
});

// Check authentication and show appropriate content
function checkAuthentication() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        // Redirect to login page
        window.location.href = 'login.html';
        return;
    }
}

// Load service history from API
async function loadServiceHistory() {
    try {
        // Show loading
        document.getElementById('historyLoading').style.display = 'block';
        
        const response = await fetch('http://localhost:3000/api/service-requests/history', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load service history');
        }
        
        const data = await response.json();
        displayHistory(data.history);
        
    } catch (error) {
        console.error('Error loading history:', error);
        document.getElementById('historyContainer').innerHTML = `
            <div class="alert alert-danger">
                Failed to load service history. Please try again later.
            </div>
        `;
    } finally {
        // Hide loading
        document.getElementById('historyLoading').style.display = 'none';
    }
}

// Display history data in UI
function displayHistory(history) {
    const container = document.getElementById('historyContainer');
    const userRole = localStorage.getItem('userRole');
    
    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-history fa-3x"></i>
                <h4>No History Yet</h4>
                <p>You haven't ${userRole === 'seeker' ? 'requested' : 'provided'} any services yet.</p>
                <a href="contact.html" class="btn btn-primary">Go to Service Hub</a>
            </div>
        `;
        return;
    }
    
    // Sort history by date (most recent first)
    history.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    // Build history HTML
    let html = '';
    history.forEach(request => {
        html += buildHistoryCard(request, userRole);
    });
    
    container.innerHTML = html;
    
    // Initialize any tooltips or popovers
    $('[data-toggle="tooltip"]').tooltip();
}

// Build HTML for a history card
function buildHistoryCard(request, userRole) {
    // Format date
    const date = new Date(request.updatedAt).toLocaleDateString();
    const time = new Date(request.updatedAt).toLocaleTimeString();
    
    // Determine badge color based on status
    let statusClass = '';
    switch(request.status) {
        case 'completed': statusClass = 'success'; break;
        case 'cancelled': statusClass = 'danger'; break;
        case 'expired': statusClass = 'secondary'; break;
        default: statusClass = 'primary';
    }
    
    return `
        <div class="history-card">
            <div class="history-header">
                <span class="category-badge">${request.category}</span>
                <span class="badge badge-${statusClass}">${request.status}</span>
            </div>
            <div class="history-body">
                <p>${request.description}</p>
                ${userRole === 'seeker' && request.provider ? 
                    `<p><strong>Provider:</strong> ${request.provider.name || 'Unknown Provider'}</p>` : ''}
                ${userRole === 'provider' && request.seeker ? 
                    `<p><strong>Client:</strong> ${request.seeker.userName || 'Unknown Client'}</p>` : ''}
                <p><strong>Date:</strong> ${date} at ${time}</p>
            </div>
            ${request.status === 'completed' ? `
                <div class="history-footer">
                    <button class="btn btn-sm btn-outline-primary leave-review-btn" 
                            data-id="${request._id}"
                            data-toggle="modal" 
                            data-target="#reviewModal">
                        <i class="fa fa-star"></i> Leave Review
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}
