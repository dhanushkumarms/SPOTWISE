/**
 * SpotWise Navigation
 * Handles consistent navigation across all pages
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if navbar exists
    const navbar = document.querySelector('.navbar-nav');
    if (!navbar) return;
    
    // Get current page path
    const currentPath = window.location.pathname;
    const pageName = currentPath.split('/').pop() || 'index.html';
    
    // Remove active class from all nav items
    document.querySelectorAll('.navbar-nav .nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Set active class based on current page
    let activeLink;
    switch(pageName) {
        case 'index.html':
            activeLink = navbar.querySelector('a[href="index.html"]');
            break;
        case 'about.html':
            activeLink = navbar.querySelector('a[href="about.html"]');
            break;
        case 'service.html':
            activeLink = navbar.querySelector('a[href="service.html"]');
            break;
        case 'contact.html':
            activeLink = navbar.querySelector('a[href="contact.html"]');
            break;
        case 'profile.html':
            activeLink = document.querySelector('#profileDropdown a[href="profile.html"]');
            break;
        case 'history.html':
            activeLink = document.querySelector('#profileDropdown a[href="history.html"]');
            break;
    }
    
    if (activeLink) {
        const parentItem = activeLink.closest('.nav-item');
        if (parentItem) {
            parentItem.classList.add('active');
        }
    }
});
