class MapService {
    constructor() {
        this.map = null;
        this.markers = new Map(); // Store markers with provider/request IDs
        this.currentLocationMarker = null;
        this.bounds = new google.maps.LatLngBounds();
        this.infoWindows = new Map(); // Store info windows for each marker
        this.isInitialized = false;
        this.providerMarkers = new Map(); // Separate collection for provider markers
        this.providerUpdateTime = new Map(); // Track when providers were last updated
        this.accuracyCircle = null; // Circle showing location accuracy
        this.followMode = false; // Whether to keep map centered on user location
        this.markerClusterer = null; // For clustering provider markers
        this.staleTimeout = 5 * 60 * 1000; // 5 minutes until a marker is considered stale
        this.animationSpeed = 500; // Animation duration in ms
    }

    // Initialize map
    async initMap(containerId) {
        try {
            if (this.isInitialized) {
                console.warn('Map already initialized');
                return this.map;
            }
            
            const mapElement = document.getElementById(containerId);
            if (!mapElement) {
                throw new Error(`Map container element with ID '${containerId}' not found`);
            }
            
            // Default center (can be updated with user's location)
            const defaultCenter = { lat: 11.0168, lng: 76.9558 }; // Coimbatore coordinates

            this.map = new google.maps.Map(mapElement, {
                zoom: 13,
                center: defaultCenter,
                styles: this.getMapStyles(),
                mapTypeControl: false,
                fullscreenControl: true,
                streetViewControl: false,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            });
            
            // Set initialized flag
            this.isInitialized = true;

            // Initialize location service if available
            if (window.locationService) {
                window.locationService.init();
            }

            // Try to get user's current location
            try {
                let userLocation;
                
                if (window.locationService) {
                    try {
                        userLocation = await window.locationService.getCurrentLocation({ 
                            requestPermission: false, // Don't show the permission UI yet
                            highAccuracy: true 
                        });
                    } catch (locationError) {
                        console.warn('Error using location service:', locationError);
                        
                        // Fallback to internal method
                        try {
                            const position = await this.getCurrentLocation();
                            userLocation = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };
                        } catch (internalError) {
                            console.warn('Error using internal geolocation:', internalError);
                            throw new Error('Could not get location');
                        }
                    }
                } else {
                    // Fallback to our internal method
                    const position = await this.getCurrentLocation();
                    userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                }
                
                // Set map center to user location
                this.map.setCenter(userLocation);
                this.addCurrentLocationMarker(userLocation);
                
                // Store user location in localStorage for quick access
                localStorage.setItem('lastUserLocation', JSON.stringify(userLocation));
                
                // If location service is available, get address for current location
                if (window.locationService) {
                    try {
                        const result = await window.locationService.getAddressFromCoordinates(userLocation);
                        if (result && this.currentLocationMarker && this.infoWindows.get('currentLocation')) {
                            const address = result.formatted_address;
                            this.infoWindows.get('currentLocation').setContent(
                                `<div><strong>Your Location</strong><br>${address}</div>`
                            );
                        }
                    } catch (error) {
                        console.warn('Could not retrieve address for current location:', error);
                    }
                }
            } catch (error) {
                console.warn('Error getting current location:', error);
                
                // Try to use last known location from localStorage or locationService
                let fallbackLocation = null;
                
                // Try location service first
                if (window.locationService && window.locationService.lastLocation) {
                    fallbackLocation = window.locationService.lastLocation;
                }
                
                // Then try localStorage
                if (!fallbackLocation) {
                    const lastLocation = localStorage.getItem('lastUserLocation');
                    if (lastLocation) {
                        try {
                            fallbackLocation = JSON.parse(lastLocation);
                        } catch (e) {
                            console.error('Error parsing stored location:', e);
                        }
                    }
                }
                
                // Use fallback or default
                if (fallbackLocation) {
                    this.map.setCenter(fallbackLocation);
                    this.addCurrentLocationMarker(fallbackLocation);
                } else {
                    console.log('Using default location');
                }
                
                // Add a notice to the map that location access could improve the experience
                this.addLocationPermissionNotice();
            }

            // Add resize event listener to handle responsive layout changes
            window.addEventListener('resize', () => {
                google.maps.event.trigger(this.map, 'resize');
                this.updateBounds();
            });

            return this.map;
        } catch (error) {
            console.error('Failed to initialize map:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    // Get current location using Geolocation API
    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }
            
            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };
            
            // Show loading indicator
            const locationLoadingIndicator = document.createElement('div');
            locationLoadingIndicator.id = 'locationLoadingIndicator';
            locationLoadingIndicator.innerHTML = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            background: rgba(255,255,255,0.8); padding: 20px; border-radius: 10px; 
                            box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 9999;">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">Loading...</span>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <p>Getting your location...</p>
                    </div>
                </div>
            `;
            document.body.appendChild(locationLoadingIndicator);
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Remove loading indicator
                    const loadingIndicator = document.getElementById('locationLoadingIndicator');
                    if (loadingIndicator) loadingIndicator.remove();
                    
                    resolve(position);
                }, 
                (error) => {
                    // Remove loading indicator
                    const loadingIndicator = document.getElementById('locationLoadingIndicator');
                    if (loadingIndicator) loadingIndicator.remove();
                    
                    console.warn('Geolocation error:', error);
                    
                    // Handle different error types
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            reject(new Error('Location permission denied'));
                            break;
                        case error.POSITION_UNAVAILABLE:
                            reject(new Error('Location information is unavailable'));
                            break;
                        case error.TIMEOUT:
                            reject(new Error('The request to get location timed out'));
                            break;
                        default:
                            reject(new Error('An unknown error occurred'));
                            break;
                    }
                }, 
                options
            );
        });
    }

    // Add a notice to request location permission
    addLocationPermissionNotice() {
        if (!this.isInitialized || !this.map) return;
        
        // Create the control div
        const controlDiv = document.createElement('div');
        controlDiv.className = 'location-permission-control';
        controlDiv.style.margin = '10px';
        controlDiv.style.backgroundColor = '#fff';
        controlDiv.style.border = '2px solid #fff';
        controlDiv.style.borderRadius = '3px';
        controlDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        controlDiv.style.cursor = 'pointer';
        controlDiv.style.textAlign = 'center';
        controlDiv.title = 'Click to use your current location';
        
        // Set the inner content
        controlDiv.innerHTML = `
            <div style="padding: 6px 10px;">
                <i class="fa fa-location-arrow" style="margin-right: 5px;"></i> Use My Location
            </div>
        `;
        
        // Add click event
        controlDiv.addEventListener('click', () => {
            if (window.locationService) {
                window.locationService.getCurrentLocation({ requestPermission: true })
                    .then(position => {
                        this.map.setCenter(position);
                        this.addCurrentLocationMarker(position);
                        controlDiv.remove(); // Remove the control after it's used
                    })
                    .catch(error => console.warn('Error getting location:', error));
            } else {
                this.getCurrentLocation()
                    .then(position => {
                        const location = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        this.map.setCenter(location);
                        this.addCurrentLocationMarker(location);
                        controlDiv.remove(); // Remove the control after it's used
                    })
                    .catch(error => console.warn('Error getting location:', error));
            }
        });
        
        // Add the control to the map
        this.map.controls[google.maps.ControlPosition.TOP_CENTER].push(controlDiv);
    }

    // Add marker for current user's location
    addCurrentLocationMarker(position) {
        if (!this.isInitialized || !this.map) {
            console.error('Map not initialized. Cannot add current location marker.');
            return;
        }
        
        try {
            const hasExistingMarker = !!this.currentLocationMarker;
            const latLng = position instanceof google.maps.LatLng ? 
                position : new google.maps.LatLng(position.lat, position.lng);
            
            // If marker exists, animate to new position
            if (hasExistingMarker) {
                this._animateMarkerMove(this.currentLocationMarker, 
                    this.currentLocationMarker.getPosition(), latLng);
            } else {
                // Create new marker if it doesn't exist
                this.currentLocationMarker = new google.maps.Marker({
                    position: latLng,
                    map: this.map,
                    icon: {
                        url: 'images/current-location.jpeg',
                        scaledSize: new google.maps.Size(30, 30)
                    },
                    title: 'Your Location',
                    zIndex: 1000, // Keep above other markers
                    optimized: false // Better animation performance for frequent updates
                });

                // Add info window for current location
                const infoWindow = new google.maps.InfoWindow({
                    content: '<div><strong>Your Location</strong></div>'
                });
                
                this.infoWindows.set('currentLocation', infoWindow);

                this.currentLocationMarker.addListener('click', () => {
                    // Close any other open info windows
                    this.infoWindows.forEach((window, key) => {
                        if (key !== 'currentLocation') window.close();
                    });
                    
                    infoWindow.open(this.map, this.currentLocationMarker);
                });
            }

            // Update accuracy circle if we have accuracy data
            if (position.coords && position.coords.accuracy) {
                this.showAccuracyCircle(latLng, position.coords.accuracy);
            } else if (this.accuracyCircle) {
                // Remove accuracy circle if no accuracy info
                this.accuracyCircle.setMap(null);
                this.accuracyCircle = null;
            }

            // If follow mode is enabled, center map on user location
            if (this.followMode) {
                this.map.panTo(latLng);
            }
            
            return this.currentLocationMarker;
        } catch (error) {
            console.error('Error adding current location marker:', error);
            return null;
        }
    }

    /**
     * Show accuracy circle around current location
     * @param {google.maps.LatLng} position - The center position
     * @param {number} accuracy - Accuracy in meters
     */
    showAccuracyCircle(position, accuracy) {
        if (!this.isInitialized || !this.map) return;
        
        try {
            if (this.accuracyCircle) {
                // Update existing circle
                this.accuracyCircle.setCenter(position);
                this.accuracyCircle.setRadius(accuracy);
            } else {
                // Create new circle
                this.accuracyCircle = new google.maps.Circle({
                    strokeColor: "#4285F4",
                    strokeOpacity: 0.5,
                    strokeWeight: 1,
                    fillColor: "#4285F4",
                    fillOpacity: 0.15,
                    map: this.map,
                    center: position,
                    radius: accuracy,
                    clickable: false,
                    zIndex: 1 // Below markers
                });
            }
        } catch (error) {
            console.error('Error showing accuracy circle:', error);
        }
    }

    /**
     * Toggle follow mode - keeps map centered on user location
     * @param {boolean} enabled - Whether follow mode is enabled
     */
    setFollowMode(enabled) {
        this.followMode = enabled;
        
        // If enabled and we have a current location, center on it
        if (enabled && this.currentLocationMarker) {
            this.map.panTo(this.currentLocationMarker.getPosition());
        }
        
        return this.followMode;
    }

    // Add or update provider marker
    updateProviderMarker(providerId, position, details) {
        if (!this.isInitialized || !this.map) {
            console.error('Map not initialized. Cannot update provider marker.');
            return false;
        }
        
        try {
            if (!providerId) {
                console.error('Provider ID is required');
                return false;
            }
            
            if (!position || typeof position.lat !== 'function' && (position.lat === undefined || position.lng === undefined)) {
                console.error('Invalid position object:', position);
                
                // Try to convert to proper position if it's not already
                if (position && typeof position.lat === 'number') {
                    position = new google.maps.LatLng(position.lat, position.lng);
                } else {
                    return false;
                }
            }
            
            // Ensure details object exists
            details = details || {
                name: 'Service Provider',
                service: 'General Service',
                rating: '4.5'
            };
            
            // Record last update time
            this.providerUpdateTime.set(providerId, Date.now());

            const isCurrentUser = providerId === localStorage.getItem('userId');

            // Check if marker already exists
            if (this.providerMarkers.has(providerId)) {
                // Update existing marker position
                const marker = this.providerMarkers.get(providerId);
                
                // Animate marker movement if it's not your marker or if it's your marker but not in follow mode
                if (!isCurrentUser || !this.followMode) {
                    this._animateMarkerMove(marker, marker.getPosition(), position);
                } else {
                    marker.setPosition(position);
                }
                
                // Update info window content if available
                const infoWindow = this.infoWindows.get(providerId);
                if (infoWindow) {
                    infoWindow.setContent(this.createProviderInfoContent(providerId, details));
                }
                
                // Remove stale class if it exists
                if (marker.getIcon() && marker.getIcon().url) {
                    const iconUrl = marker.getIcon().url;
                    if (iconUrl.includes('-stale')) {
                        const freshIconUrl = iconUrl.replace('-stale', '');
                        marker.setIcon({
                            url: freshIconUrl,
                            scaledSize: new google.maps.Size(40, 40)
                        });
                    }
                }
            } else {
                // Create new marker
                const marker = new google.maps.Marker({
                    position: position,
                    map: this.map,
                    icon: {
                        url: isCurrentUser ? 
                            'images/my-location-marker.png' : 'images/provider-marker.png',
                        scaledSize: new google.maps.Size(40, 40)
                    },
                    title: details.name,
                    animation: google.maps.Animation.DROP,
                    zIndex: isCurrentUser ? 1000 : 100, // Keep own marker on top
                    optimized: false // Better animation performance for frequent updates
                });

                // Add info window for provider
                const infoWindow = new google.maps.InfoWindow({
                    content: this.createProviderInfoContent(providerId, details)
                });

                marker.addListener('click', () => {
                    // Close any other open info windows
                    this.infoWindows.forEach((window, key) => {
                        if (key !== providerId) window.close();
                    });
                    
                    infoWindow.open(this.map, marker);
                });

                // Store markers in both collections
                this.providerMarkers.set(providerId, marker);
                this.markers.set(providerId, marker);
                this.infoWindows.set(providerId, infoWindow);
                
                // Add to cluster if we're using clustering
                if (this.markerClusterer) {
                    this.markerClusterer.addMarker(marker);
                }
            }

            this.updateBounds();
            return true;
        } catch (error) {
            console.error('Error updating provider marker:', error);
            return false;
        }
    }
    
    // Clear all provider markers except current user
    clearProviderMarkers() {
        try {
            const currentUserId = localStorage.getItem('userId');
            
            this.providerMarkers.forEach((marker, id) => {
                if (id !== currentUserId) {
                    marker.setMap(null);
                    
                    // Close info window if open
                    if (this.infoWindows.has(id)) {
                        this.infoWindows.get(id).close();
                    }
                    
                    // Remove from both collections
                    this.providerMarkers.delete(id);
                    this.markers.delete(id);
                    this.infoWindows.delete(id);
                    this.providerUpdateTime.delete(id);
                    
                    // Remove from clusterer if it exists
                    if (this.markerClusterer) {
                        this.markerClusterer.removeMarker(marker);
                    }
                }
            });
        } catch (error) {
            console.error('Error clearing provider markers:', error);
        }
    }
    
    // Create HTML content for provider info window with enhanced info and freshness
    createProviderInfoContent(providerId, details) {
        const isCurrentUser = providerId === localStorage.getItem('userId');
        const lastUpdate = this.providerUpdateTime.get(providerId);
        let timeDisplay = '';
        
        if (lastUpdate && !isCurrentUser) {
            const now = Date.now();
            const diff = now - lastUpdate;
            
            if (diff < 60000) { // Less than a minute
                timeDisplay = '<span class="text-success">Updated just now</span>';
            } else if (diff < 300000) { // Less than 5 minutes
                const minutes = Math.floor(diff / 60000);
                timeDisplay = `<span class="text-success">Updated ${minutes} min${minutes > 1 ? 's' : ''} ago</span>`;
            } else if (diff < 3600000) { // Less than an hour
                const minutes = Math.floor(diff / 60000);
                timeDisplay = `<span class="text-warning">Updated ${minutes} mins ago</span>`;
            } else { // More than an hour
                const hours = Math.floor(diff / 3600000);
                timeDisplay = `<span class="text-danger">Updated ${hours} hour${hours > 1 ? 's' : ''} ago</span>`;
            }
        }
        
        // Additional info for distance if provided
        const distanceInfo = details.distance ? 
            `<p><i class="fa fa-map-marker"></i> ${details.distance}</p>` : '';
            
        return `
            <div class="provider-info">
                <h3>${details.name}${isCurrentUser ? ' <span class="badge badge-primary">You</span>' : ''}</h3>
                <p><strong>Service:</strong> ${details.service}</p>
                <p><strong>Rating:</strong> ${details.rating} ⭐</p>
                ${distanceInfo}
                ${timeDisplay ? `<p class="text-muted small">${timeDisplay}</p>` : ''}
                ${!isCurrentUser ? `<button class="map-action-btn btn btn-sm btn-primary" onclick="requestService('${providerId}')">Request Service</button>` : ''}
            </div>
        `;
    }

    /**
     * Check for stale markers and update their appearance
     */
    checkStaleMarkers() {
        const now = Date.now();
        
        this.providerMarkers.forEach((marker, id) => {
            const lastUpdate = this.providerUpdateTime.get(id);
            const isCurrentUser = id === localStorage.getItem('userId');
            
            // Skip current user marker
            if (isCurrentUser) return;
            
            if (lastUpdate && now - lastUpdate > this.staleTimeout) {
                // Marker is stale, update its appearance
                const icon = marker.getIcon();
                if (icon && icon.url && !icon.url.includes('-stale')) {
                    const staleIconUrl = icon.url.replace('.png', '-stale.png');
                    marker.setIcon({
                        url: staleIconUrl,
                        scaledSize: new google.maps.Size(40, 40)
                    });
                    
                    // Update info window to show stale status
                    const infoWindow = this.infoWindows.get(id);
                    if (infoWindow) {
                        // Get existing details to recreate content
                        const title = marker.getTitle();
                        infoWindow.setContent(this.createProviderInfoContent(id, {
                            name: title,
                            service: 'Service Provider',
                            rating: '4.5'
                        }));
                    }
                }
            }
        });
    }

    // Add service request marker
    addRequestMarker(requestId, position, details) {
        if (!this.isInitialized || !this.map) {
            console.error('Map not initialized. Cannot add request marker.');
            return;
        }
        
        try {
            if (!requestId) {
                console.error('Request ID is required');
                return;
            }
            
            if (!position || (!position.lat && !position.lat()) || (!position.lng && !position.lng())) {
                console.error('Invalid position object:', position);
                return;
            }
            
            // Convert position to LatLng if needed
            if (typeof position.lat === 'number') {
                position = new google.maps.LatLng(position.lat, position.lng);
            }
            
            // Default details
            details = details || {
                service: 'General Service',
                status: 'pending',
                description: 'No description provided',
                canAccept: false
            };

            const marker = new google.maps.Marker({
                position: position,
                map: this.map,
                icon: {
                    url: 'images/request-marker.png', // Add this icon to your images folder
                    scaledSize: new google.maps.Size(35, 35)
                },
                title: `Service Request: ${details.service}`,
                animation: google.maps.Animation.DROP
            });

            // Add info window for request
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div class="request-info">
                        <h3>Service Request</h3>
                        <p>Service: ${details.service}</p>
                        <p>Status: ${details.status}</p>
                        <p>Description: ${details.description}</p>
                        ${details.canAccept ? 
                            `<button class="map-action-btn" onclick="acceptRequest('${requestId}')">Accept Request</button>` : 
                            ''}
                    </div>
                `
            });

            marker.addListener('click', () => {
                // Close any other open info windows
                this.infoWindows.forEach((window, key) => {
                    if (key !== requestId) window.close();
                });
                
                infoWindow.open(this.map, marker);
            });

            this.markers.set(requestId, marker);
            this.infoWindows.set(requestId, infoWindow);
            this.updateBounds();
            
            return marker;
        } catch (error) {
            console.error('Error adding request marker:', error);
            return null;
        }
    }

    // Remove marker
    removeMarker(id) {
        if (!id) return false;
        
        try {
            if (this.markers.has(id)) {
                // Close info window if open
                if (this.infoWindows.has(id)) {
                    this.infoWindows.get(id).close();
                    this.infoWindows.delete(id);
                }
                
                // Remove marker from map
                this.markers.get(id).setMap(null);
                this.markers.delete(id);
                
                // Update bounds after marker removal
                this.updateBounds();
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Error removing marker with ID ${id}:`, error);
            return false;
        }
    }

    // Update map bounds to show all markers
    updateBounds() {
        if (!this.isInitialized || !this.map) return;
        
        try {
            // Only adjust bounds if we have markers
            if (this.markers.size === 0 && !this.currentLocationMarker) return;
            
            this.bounds = new google.maps.LatLngBounds();
            
            // Add all markers to bounds
            this.markers.forEach(marker => {
                this.bounds.extend(marker.getPosition());
            });
            
            // Add current location marker to bounds if it exists
            if (this.currentLocationMarker) {
                this.bounds.extend(this.currentLocationMarker.getPosition());
            }
            
            // Only adjust bounds if we added any positions
            if (!this.bounds.isEmpty()) {
                this.map.fitBounds(this.bounds);
                
                // If we have only one marker, zoom out a bit
                if (this.markers.size <= 1 && !this.currentLocationMarker || 
                    this.markers.size === 0 && this.currentLocationMarker) {
                    const listener = google.maps.event.addListener(this.map, 'idle', () => {
                        if (this.map.getZoom() > 15) this.map.setZoom(15);
                        google.maps.event.removeListener(listener);
                    });
                }
            }
        } catch (error) {
            console.error('Error updating map bounds:', error);
        }
    }

    // Pan to specific location with animation
    panTo(position, zoom = 15) {
        if (!this.isInitialized || !this.map) return;
        
        try {
            // Convert position to LatLng if needed
            if (typeof position.lat === 'number') {
                position = new google.maps.LatLng(position.lat, position.lng);
            }
            
            // Temporarily disable follow mode if explicitly panning
            const wasFollowMode = this.followMode;
            this.followMode = false;
            
            // Pan with animation
            this.map.panTo(position);
            
            if (zoom !== this.map.getZoom()) {
                this.map.setZoom(zoom);
            }
            
            // Restore follow mode after a short delay if it was enabled
            if (wasFollowMode) {
                setTimeout(() => {
                    this.followMode = wasFollowMode;
                }, 3000);
            }
        } catch (error) {
            console.error('Error panning map:', error);
        }
    }
    
    // Clear all markers except current location
    clearAllMarkers() {
        if (!this.isInitialized) return;
        
        try {
            this.markers.forEach((marker, id) => {
                marker.setMap(null);
                
                // Close info window if open
                if (this.infoWindows.has(id)) {
                    this.infoWindows.get(id).close();
                }
            });
            
            this.markers.clear();
            this.infoWindows.clear();
            
            // Keep current location marker and its info window
            if (this.currentLocationMarker) {
                this.infoWindows.set('currentLocation', this.infoWindows.get('currentLocation'));
            }
        } catch (error) {
            console.error('Error clearing markers:', error);
        }
    }

    /**
     * Initialize marker clustering for provider markers
     */
    initMarkerClustering() {
        if (!this.isInitialized || !window.MarkerClusterer) return;
        
        try {
            // Convert providerMarkers to array for clustering
            const markers = Array.from(this.providerMarkers.values());
            
            this.markerClusterer = new MarkerClusterer(this.map, markers, {
                imagePath: 'images/m',
                gridSize: 50,
                minimumClusterSize: 3,
                maxZoom: 15
            });
        } catch (error) {
            console.error('Error initializing marker clustering:', error);
        }
    }

    /**
     * Animate marker movement from one position to another
     * @param {google.maps.Marker} marker - The marker to animate
     * @param {google.maps.LatLng} current - Current position
     * @param {google.maps.LatLng} destination - Destination position
     * @private
     */
    _animateMarkerMove(marker, current, destination) {
        if (!marker || !current || !destination) return;
        
        // If current and destination are the same, no need to animate
        if (current.equals(destination)) return;

        // Make sure we have proper LatLng objects
        if (typeof current.lat !== 'function') {
            current = new google.maps.LatLng(current.lat, current.lng);
        }
        if (typeof destination.lat !== 'function') {
            destination = new google.maps.LatLng(destination.lat, destination.lng);
        }
        
        // Don't animate if the distance is too large (teleport instead)
        const distance = this._haversineDistance(
            { lat: current.lat(), lng: current.lng() },
            { lat: destination.lat(), lng: destination.lng() }
        );
        
        if (distance > 5) { // More than 5km, just teleport
            marker.setPosition(destination);
            return;
        }
        
        // Calculate animation frames for smoother movement for close distances
        const frames = Math.min(Math.ceil(distance * 10), 100);
        const animationSpeed = distance < 0.1 ? 200 : this.animationSpeed;
        const deltaLat = (destination.lat() - current.lat()) / frames;
        const deltaLng = (destination.lng() - current.lng()) / frames;
        
        let frame = 0;
        
        const animate = () => {
            if (frame < frames) {
                frame++;
                
                const lat = current.lat() + deltaLat * frame;
                const lng = current.lng() + deltaLng * frame;
                
                marker.setPosition(new google.maps.LatLng(lat, lng));
                
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    /**
     * Calculate the haversine distance between two points
     * @param {Object} p1 - First point {lat, lng}
     * @param {Object} p2 - Second point {lat, lng}
     * @returns {number} - Distance in kilometers
     * @private
     */
    _haversineDistance(p1, p2) {
        const R = 6371; // Earth radius in kilometers
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Custom map styles
    getMapStyles() {
        return [
            {
                "featureType": "poi",
                "elementType": "labels",
                "stylers": [
                    { "visibility": "off" }
                ]
            },
            {
                "featureType": "transit",
                "elementType": "labels",
                "stylers": [
                    { "visibility": "off" }
                ]
            }
        ];
    }
}

// Start checking for stale markers every minute
setInterval(() => {
    if (window.mapService && window.mapService.checkStaleMarkers) {
        window.mapService.checkStaleMarkers();
    }
}, 60000);

// Export the service
window.mapService = new MapService();