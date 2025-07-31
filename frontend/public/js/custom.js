// to get current year
function getYear() {
    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    document.querySelector("#displayYear").innerHTML = currentYear;
}

getYear();

/** google_map js **/
function myMap() {
    try {
        var mapProp = {
            center: new google.maps.LatLng(40.712775, -74.005973),
            zoom: 18,
        };
        var map = new google.maps.Map(document.getElementById("googleMap"), mapProp);
    } catch (e) {
        console.log("Map initialization error:", e.message);
    }
}

// Login/profile toggle functionality
function updateLoginUI() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const loginButton = document.getElementById('loginButton');
    const profileMenu = document.getElementById('profileMenu');
    
    if (loginButton && profileMenu) {
        if (isLoggedIn) {
            loginButton.style.display = 'none';
            profileMenu.style.display = 'block';
        } else {
            loginButton.style.display = 'block';
            profileMenu.style.display = 'none';
        }
    }
}

// Setup logout functionality
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('isLoggedIn');
            window.location.reload();
        });
    }
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    updateLoginUI();
    setupLogout();
    
    // For testing - add to window object
    window.simulateLogin = function() {
        localStorage.setItem('isLoggedIn', 'true');
        window.location.reload();
    };
});