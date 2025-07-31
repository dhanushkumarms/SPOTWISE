/**
 * SpotWise Maps Error Handler
 * Provides fallback and error handling for Google Maps API issues
 */

// Create a global maps error handler
window.mapsErrorHandler = {
  // Flag to check if Maps API loaded correctly
  apiLoaded: false,
  
  // Placeholder map implementation when Google Maps fails to load
  createPlaceholderMap: function(container) {
    if (!container) return;
    
    // Clear the container
    container.innerHTML = '';
    container.style.position = 'relative';
    
    // Create a placeholder map with error message
    const placeholderDiv = document.createElement('div');
    placeholderDiv.className = 'maps-placeholder';
    placeholderDiv.style.width = '100%';
    placeholderDiv.style.height = '100%';
    placeholderDiv.style.backgroundColor = '#f0f0f0';
    placeholderDiv.style.display = 'flex';
    placeholderDiv.style.alignItems = 'center';
    placeholderDiv.style.justifyContent = 'center';
    placeholderDiv.style.flexDirection = 'column';
    placeholderDiv.style.textAlign = 'center';
    placeholderDiv.style.padding = '20px';
    
    const iconDiv = document.createElement('div');
    iconDiv.innerHTML = '<i class="fa fa-map-marker" style="font-size: 48px; color: #999; margin-bottom: 15px;"></i>';
    
    const messageDiv = document.createElement('div');
    messageDiv.innerHTML = '<h4>Map could not be loaded</h4>' +
                          '<p>We\'re experiencing issues with our mapping service.</p>' +
                          '<p>Please try refreshing the page or try again later.</p>';
    
    placeholderDiv.appendChild(iconDiv);
    placeholderDiv.appendChild(messageDiv);
    container.appendChild(placeholderDiv);
    
    return {
      setCenter: function() {},
      addListener: function() {},
      controls: { push: function() {} },
      fitBounds: function() {},
      setZoom: function() {}
    };
  },
  
  // Handle the global Maps API error
  handleMapsApiError: function() {
    console.error('Google Maps failed to load properly');
    
    // Find all map containers and replace with placeholders
    const mapContainers = document.querySelectorAll('.map-container, #map, #serviceMap, #locationMap, #locationPickerMap, #jobLocationMap');
    mapContainers.forEach(container => {
      this.createPlaceholderMap(container);
    });
    
    // Provide a global google.maps placeholder to prevent script errors
    window.google = window.google || {};
    window.google.maps = window.google.maps || {
      Map: function() { return window.mapsErrorHandler.createPlaceholderMap(); },
      LatLng: function(lat, lng) { return { lat: lat || 0, lng: lng || 0 }; },
      Marker: function() { return { setPosition: function() {}, setMap: function() {} }; },
      event: { addListener: function() {} },
      places: {
        Autocomplete: function() { return { addListener: function() {} }; },
        SearchBox: function() { return { addListener: function() {}, setBounds: function() {}, getPlaces: function() { return []; } }; }
      },
      Geocoder: function() { return { geocode: function(_, callback) { callback([], 'ERROR'); } }; },
      InfoWindow: function() { return { setContent: function() {}, open: function() {} }; },
      ControlPosition: { TOP_LEFT: 1 }
    };
  }
};

// Define global initMapsCallback function that will be called by Google Maps API
window.initMapsCallback = function() {
  window.mapsErrorHandler.apiLoaded = true;
  
  // Initialize map services if they exist
  if (window.mapService && typeof window.mapService.init === 'function') {
    window.mapService.init();
  }
  
  if (window.requestService && typeof window.requestService.init === 'function') {
    window.requestService.init();
  }
  
  // Additional specific map initializations
  if (window.initMap && typeof window.initMap === 'function') {
    window.initMap();
  }
  
  if (window.initLocationPicker && typeof window.initLocationPicker === 'function') {
    window.initLocationPicker();
  }
  
  // Dispatch a custom event that other scripts can listen for
  document.dispatchEvent(new CustomEvent('googleMapsLoaded'));
};

// Handle Google Maps API errors
window.gm_authFailure = function() {
  console.error('Google Maps authentication failed');
  window.mapsErrorHandler.handleMapsApiError();
};
