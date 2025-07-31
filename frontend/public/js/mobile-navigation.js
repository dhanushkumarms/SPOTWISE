/**
 * SPOTWISE Mobile Navigation
 * Enhances mobile navigation with better touch interactions and accessibility
 */

class MobileNavigation {
  constructor() {
    // Core elements
    this.navbar = null;
    this.navbarCollapse = null;
    this.navbarToggler = null;
    this.mobileMenuBackdrop = null;
    
    // State
    this.isMenuOpen = false;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.swipeThreshold = 100; // Minimum distance for swipe detection
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => this.init());
  }
  
  /**
   * Initialize the mobile navigation
   */
  init() {
    // Find navbar elements
    this.navbar = document.querySelector('.navbar');
    this.navbarCollapse = document.querySelector('.navbar-collapse');
    this.navbarToggler = document.querySelector('.navbar-toggler');
    
    if (!this.navbar || !this.navbarCollapse || !this.navbarToggler) {
      console.warn('Mobile navigation elements not found');
      return;
    }
    
    // Create backdrop for mobile menu
    this.createBackdrop();
    
    // Create close button inside mobile menu
    this.createCloseButton();
    
    // Add mobile menu header
    this.createMobileMenuHeader();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Add touch swipe support
    this.setupSwipeSupport();
    
    // Add icons to navigation links
    this.addIconsToNavLinks();
    
    // Make profile dropdown touch-friendly
    this.enhanceProfileDropdown();
    
    console.log('Mobile navigation initialized');
  }
  
  /**
   * Create backdrop element for mobile menu
   */
  createBackdrop() {
    this.mobileMenuBackdrop = document.createElement('div');
    this.mobileMenuBackdrop.className = 'menu-backdrop';
    document.body.appendChild(this.mobileMenuBackdrop);
    
    // Close menu when backdrop is clicked
    this.mobileMenuBackdrop.addEventListener('click', () => {
      this.closeMenu();
    });
  }
  
  /**
   * Create close button inside mobile menu
   */
  createCloseButton() {
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'mobile-menu-close';
    closeButton.innerHTML = '<i class="fa fa-times"></i>';
    closeButton.setAttribute('aria-label', 'Close menu');
    
    closeButton.addEventListener('click', () => {
      this.closeMenu();
    });
    
    this.navbarCollapse.insertBefore(closeButton, this.navbarCollapse.firstChild);
  }
  
  /**
   * Create mobile menu header
   */
  createMobileMenuHeader() {
    // Skip if navbar brand doesn't exist
    const navbarBrand = this.navbar.querySelector('.navbar-brand');
    if (!navbarBrand) return;
    
    // Create header container
    const headerContainer = document.createElement('div');
    headerContainer.className = 'mobile-menu-header';
    
    // Clone navbar brand for menu header
    const brandClone = navbarBrand.cloneNode(true);
    brandClone.style.display = 'block';
    headerContainer.appendChild(brandClone);
    
    // Insert header at the beginning of navbar collapse
    this.navbarCollapse.insertBefore(headerContainer, this.navbarCollapse.firstChild);
  }
  
  /**
   * Set up event listeners for mobile menu
   */
  setupEventListeners() {
    // Toggle menu when toggler is clicked
    this.navbarToggler.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMenu();
    });
    
    // Handle resize events to reset menu state when switching to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992 && this.isMenuOpen) {
        this.closeMenu(true);
      }
    });
    
    // Handle nav link clicks to close menu
    const navLinks = this.navbarCollapse.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        this.closeMenu();
      });
    });
    
    // Handle escape key to close menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isMenuOpen) {
        this.closeMenu();
      }
    });
  }
  
  /**
   * Add swipe support for mobile menu
   */
  setupSwipeSupport() {
    // Enable swipe to open menu from left edge
    document.addEventListener('touchstart', (e) => {
      if (e.touches[0].clientX < 30 && !this.isMenuOpen) {
        this.touchStartX = e.touches[0].clientX;
      } else if (this.isMenuOpen) {
        this.touchStartX = e.touches[0].clientX;
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      if (this.touchStartX > 0) {
        this.touchCurrentX = e.touches[0].clientX;
        
        // If menu is closed, handle opening via swipe
        if (!this.isMenuOpen && this.touchCurrentX - this.touchStartX > 50) {
          // Prevent scrolling when swiping to open menu
          if (e.cancelable) {
            e.preventDefault();
          }
          
          // Calculate swipe progress percentage (0-100%)
          const progress = Math.min(100, ((this.touchCurrentX - this.touchStartX) / this.swipeThreshold) * 100);
          this.navbarCollapse.style.left = `${-280 + (progress * 2.8)}px`;
          this.mobileMenuBackdrop.style.display = 'block';
          this.mobileMenuBackdrop.style.opacity = progress / 100;
        }
        
        // If menu is open, handle closing via swipe
        if (this.isMenuOpen && this.touchStartX - this.touchCurrentX > 50) {
          // Calculate swipe progress percentage (0-100%)
          const progress = Math.min(100, ((this.touchStartX - this.touchCurrentX) / this.swipeThreshold) * 100);
          this.navbarCollapse.style.left = `${-(progress * 2.8)}px`;
          this.mobileMenuBackdrop.style.opacity = 1 - (progress / 100);
        }
      }
    }, { passive: false });
    
    document.addEventListener('touchend', (e) => {
      if (this.touchStartX > 0) {
        this.touchEndX = e.changedTouches[0].clientX;
        
        // Open menu if swiped far enough
        if (!this.isMenuOpen && this.touchEndX - this.touchStartX > this.swipeThreshold) {
          this.openMenu();
        } 
        // Close menu if swiped far enough
        else if (this.isMenuOpen && this.touchStartX - this.touchEndX > this.swipeThreshold) {
          this.closeMenu();
        } 
        // Reset if swipe wasn't far enough
        else {
          if (this.isMenuOpen) {
            this.navbarCollapse.style.left = '0';
            this.mobileMenuBackdrop.style.opacity = '1';
          } else {
            this.navbarCollapse.style.left = '-280px';
            this.mobileMenuBackdrop.style.display = 'none';
            this.mobileMenuBackdrop.style.opacity = '0';
          }
        }
        
        this.touchStartX = 0;
      }
    }, { passive: true });
  }
  
  /**
   * Add icons to navigation links for better visual hierarchy
   */
  addIconsToNavLinks() {
    const navItems = this.navbarCollapse.querySelectorAll('.nav-item');
    const icons = {
      'Home': 'fa-home',
      'About': 'fa-info-circle',
      'Services': 'fa-cogs',
      'Contact': 'fa-envelope',
      'Profile': 'fa-user',
      'History': 'fa-history',
      'Logout': 'fa-sign-out'
    };
    
    navItems.forEach(item => {
      const link = item.querySelector('.nav-link');
      if (!link) return;
      
      // Skip if the link already has an icon
      if (link.querySelector('i')) return;
      
      // Find matching icon
      const text = link.textContent.trim();
      const iconClass = icons[text];
      
      if (iconClass) {
        const icon = document.createElement('i');
        icon.className = `fa ${iconClass} mr-2`;
        icon.setAttribute('aria-hidden', 'true');
        link.insertBefore(icon, link.firstChild);
      }
    });
  }
  
  /**
   * Make profile dropdown touch-friendly
   */
  enhanceProfileDropdown() {
    const profileDropdown = document.getElementById('profileDropdown');
    if (!profileDropdown) return;
    
    const dropdownToggle = profileDropdown.querySelector('.dropdown-toggle');
    const dropdownMenu = profileDropdown.querySelector('.dropdown-menu');
    
    if (!dropdownToggle || !dropdownMenu) return;
    
    // Make dropdown toggle more touch-friendly
    dropdownToggle.style.padding = '8px';
    dropdownToggle.style.fontSize = '24px';
    dropdownToggle.classList.add('interactive-element');
    
    // Make dropdown menu items more touch-friendly
    const dropdownItems = dropdownMenu.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
      item.style.padding = '12px 15px';
      item.classList.add('interactive-element');
    });
  }
  
  /**
   * Toggle mobile menu open/closed
   */
  toggleMenu() {
    if (this.isMenuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }
  
  /**
   * Open mobile menu
   */
  openMenu() {
    this.navbarCollapse.style.left = '0';
    this.mobileMenuBackdrop.style.display = 'block';
    
    // Fade in backdrop
    setTimeout(() => {
      this.mobileMenuBackdrop.style.opacity = '1';
    }, 10);
    
    this.isMenuOpen = true;
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    
    this.navbarToggler.setAttribute('aria-expanded', 'true');
    this.navbarCollapse.setAttribute('aria-hidden', 'false');
    
    // Trap focus inside menu
    this.trapFocus();
  }
  
  /**
   * Close mobile menu
   * @param {boolean} immediate - If true, close without animation
   */
  closeMenu(immediate = false) {
    if (immediate) {
      this.navbarCollapse.style.left = '-280px';
      this.mobileMenuBackdrop.style.display = 'none';
    } else {
      this.navbarCollapse.style.left = '-280px';
      this.mobileMenuBackdrop.style.opacity = '0';
      
      // Hide backdrop after fade out
      setTimeout(() => {
        if (!this.isMenuOpen) {
          this.mobileMenuBackdrop.style.display = 'none';
        }
      }, 300);
    }
    
    this.isMenuOpen = false;
    document.body.style.overflow = ''; // Restore scrolling
    
    this.navbarToggler.setAttribute('aria-expanded', 'false');
    this.navbarCollapse.setAttribute('aria-hidden', 'true');
  }
  
  /**
   * Trap focus inside menu for accessibility
   */
  trapFocus() {
    // Get all focusable elements in the menu
    const focusableElements = this.navbarCollapse.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    
    if (focusableElements.length === 0) return;
    
    // Focus first element
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    firstElement.focus();
    
    // Trap focus inside menu
    this.navbarCollapse.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });
  }
}

// Initialize mobile navigation
new MobileNavigation();

/**
 * Bottom Navigation Component for Mobile
 */
class BottomNavigation {
  constructor() {
    this.bottomNavElement = null;
    this.initialized = false;
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      // Only initialize on mobile screens
      if (window.innerWidth <= 768) {
        this.init();
      }
    });
    
    // Listen for resize events
    window.addEventListener('resize', () => {
      if (window.innerWidth <= 768 && !this.initialized) {
        this.init();
      } else if (window.innerWidth > 768 && this.initialized) {
        this.destroy();
      }
    });
  }
  
  /**
   * Initialize bottom navigation
   */
  init() {
    // Don't initialize twice
    if (this.initialized) return;
    
    // Create bottom navigation
    this.bottomNavElement = document.createElement('div');
    this.bottomNavElement.className = 'bottom-nav';
    
    // Define navigation items
    const navItems = [
      { icon: 'fa-home', text: 'Home', href: 'index.html' },
      { icon: 'fa-search', text: 'Services', href: 'service.html' },
      { icon: 'fa-map', text: 'Map', href: 'service-map.html' },
      { icon: 'fa-user', text: 'Profile', href: 'profile.html' }
    ];
    
    // Get current page path
    const currentPath = window.location.pathname.split('/').pop();
    
    // Create HTML for bottom navigation
    const navItemsHtml = navItems.map(item => {
      const isActive = currentPath === item.href;
      return `
        <a href="${item.href}" class="bottom-nav-item ${isActive ? 'active' : ''}" aria-label="${item.text}">
          <i class="fa ${item.icon}" aria-hidden="true"></i>
          <span>${item.text}</span>
        </a>
      `;
    }).join('');
    
    this.bottomNavElement.innerHTML = navItemsHtml;
    
    // Add to document
    document.body.appendChild(this.bottomNavElement);
    document.body.classList.add('has-bottom-nav');
    
    this.initialized = true;
  }
  
  /**
   * Remove bottom navigation
   */
  destroy() {
    if (this.bottomNavElement && this.bottomNavElement.parentNode) {
      this.bottomNavElement.parentNode.removeChild(this.bottomNavElement);
      document.body.classList.remove('has-bottom-nav');
      this.initialized = false;
    }
  }
}

// Initialize bottom navigation
new BottomNavigation();

/**
 * Touch Feedback for Interactive Elements
 */
class TouchFeedback {
  constructor() {
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => this.init());
  }
  
  /**
   * Initialize touch feedback
   */
  init() {
    // Add ripple effect to buttons and other interactive elements
    this.addRippleEffect();
    
    // Enhance touch feedback for interactive elements
    this.enhanceTouchFeedback();
  }
  
  /**
   * Add ripple effect to buttons and other interactive elements
   */
  addRippleEffect() {
    // Add CSS for ripple effect
    const style = document.createElement('style');
    style.textContent = `
      .ripple {
        position: absolute;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
      }

      @keyframes ripple-animation {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
      
      .ripple-container {
        position: relative;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
    
    // Add ripple effect to interactive elements
    const elements = document.querySelectorAll('.btn, .nav-link, .interactive-element');
    
    elements.forEach(element => {
      // Skip if element already has ripple effect
      if (element.classList.contains('ripple-container')) return;
      
      // Add ripple container class
      element.classList.add('ripple-container');
      
      // Add event listener for creating ripple
      element.addEventListener('click', e => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        element.appendChild(ripple);
        
        // Remove ripple after animation completes
        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
  }
  
  /**
   * Enhance touch feedback for interactive elements
   */
  enhanceTouchFeedback() {
    // Add active state for interactive elements
    const elements = document.querySelectorAll('.btn, .nav-link, .interactive-element');
    
    elements.forEach(element => {
      // Add touch feedback styles
      element.addEventListener('touchstart', () => {
        element.classList.add('touch-active');
      }, { passive: true });
      
      element.addEventListener('touchend', () => {
        element.classList.remove('touch-active');
      }, { passive: true });
      
      element.addEventListener('touchcancel', () => {
        element.classList.remove('touch-active');
      }, { passive: true });
    });
    
    // Improve focus feedback for keyboard users
    document.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-user');
      }
    });
    
    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-user');
    });
    
    // Add CSS for keyboard focus and touch active states
    const style = document.createElement('style');
    style.textContent = `
      .keyboard-user :focus {
        outline: 3px solid #7335b7 !important;
        outline-offset: 3px !important;
      }
      
      .touch-active {
        transform: scale(0.97);
        transition: transform 0.1s ease;
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize touch feedback
new TouchFeedback();
