/**
 * SpotWise Location Tracking Service
 * Handles continuous location tracking for providers and location management for seekers
 */
class LocationTrackingService {
    constructor() {
        this.isTracking = false;
        this.watchId = null;
        this.lastPosition = null;
        this.trackingOptions = {
            enableHighAccuracy: true,
            maximumAge: 30000,        // 30 seconds
            timeout: 27000,           // 27 seconds
            distanceFilter: 10        // 10 meters minimum movement
        };
        this.updateInterval = 10000;  // 10 seconds between forced updates
        this.updateTimer = null;
        this.locationListeners = new Set();
        this.errorListeners = new Set();
        this.permissionDenied = false;
        this.batteryFriendly = true;
        this.minAccuracy = 50;        // meters
    }

    /**
     * Start tracking the user's location
     * @param {Object} options - Tracking options
     * @returns {Promise} - Resolves when tracking starts
     */
    startTracking(options = {}) {
        return new Promise((resolve, reject) => {
            if (this.isTracking) {
                resolve(this.lastPosition);
                return;
            }

            // Get options with defaults
            const trackingOptions = {
                ...this.trackingOptions,
                ...options
            };
            
            // Check if geolocation is supported
            if (!navigator.geolocation) {
                const error = new Error('Geolocation is not supported by this browser');
                this._notifyError(error);
                reject(error);
                return;
            }
            
            // Request permission if needed
            this._requestLocationPermission()
                .then(() => {
                    // Start watching position
                    this.watchId = navigator.geolocation.watchPosition(
                        this._handlePositionUpdate.bind(this),
                        this._handlePositionError.bind(this),
                        trackingOptions
                    );
                    
                    // Start regular updates to ensure we get updates even when not moving
                    this.updateTimer = setInterval(() => {
                        this._requestCurrentPosition();
                    }, this.updateInterval);
                    
                    this.isTracking = true;
                    
                    // Get initial position immediately
                    this._requestCurrentPosition()
                        .then(resolve)
                        .catch(reject);
                })
                .catch(error => {
                    this._notifyError(error);
                    reject(error);
                });
        });
    }

    /**
     * Stop tracking the user's location
     */
    stopTracking() {
        if (!this.isTracking) return;
        
        // Clear the watch
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Clear the update timer
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        this.isTracking = false;
        console.log('Location tracking stopped');
        
        // Notify listeners that tracking has stopped
        this._notifyListeners({
            type: 'tracking-stopped',
            timestamp: new Date()
        });
    }

    /**
     * Toggle battery-friendly mode
     * @param {boolean} enabled - Whether battery-friendly mode is enabled
     */
    setBatteryFriendly(enabled) {
        this.batteryFriendly = enabled;
        
        // If tracking, restart with new settings
        if (this.isTracking) {
            this.stopTracking();
            this.startTracking({
                enableHighAccuracy: !this.batteryFriendly
            });
        }
    }

    /**
     * Add location update listener
     * @param {Function} listener - Callback function for location updates
     * @returns {Function} - Function to remove the listener
     */
    addLocationListener(listener) {
        this.locationListeners.add(listener);
        return () => this.locationListeners.delete(listener);
    }

    /**
     * Add error listener
     * @param {Function} listener - Callback function for errors
     * @returns {Function} - Function to remove the listener
     */
    addErrorListener(listener) {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }

    /**
     * Get the last known position
     * @returns {Object|null} - The last position or null if no position is available
     */
    getLastPosition() {
        return this.lastPosition;
    }

    /**
     * Request location permission
     * @returns {Promise} - Resolves when permission is granted
     * @private
     */
    _requestLocationPermission() {
        return new Promise((resolve, reject) => {
            // If permission was previously denied, try to use the UI helper
            if (this.permissionDenied && window.locationService) {
                window.locationService.showLocationPermissionRequest()
                    .then(resolve)
                    .catch(reject);
                return;
            }
            
            // Otherwise, just try to get the current position to trigger permission
            navigator.geolocation.getCurrentPosition(
                () => resolve(),
                (error) => {
                    if (error.code === error.PERMISSION_DENIED) {
                        this.permissionDenied = true;
                        reject(new Error('Location permission denied'));
                    } else {
                        resolve(); // Resolve for other errors, we'll retry in watch
                    }
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    /**
     * Get current position once
     * @returns {Promise} - Resolves with the current position
     * @private
     */
    _requestCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this._handlePositionUpdate(position);
                    resolve(this._formatPosition(position));
                },
                (error) => {
                    this._handlePositionError(error);
                    reject(error);
                },
                {
                    enableHighAccuracy: !this.batteryFriendly,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    /**
     * Handle position update from geolocation API
     * @param {Position} position - The position from geolocation API
     * @private
     */
    _handlePositionUpdate(position) {
        // Check if position has changed significantly
        if (this._shouldUpdatePosition(position)) {
            const formattedPosition = this._formatPosition(position);
            this.lastPosition = formattedPosition;
            
            // Store in localStorage for recovery
            localStorage.setItem('lastUserLocation', JSON.stringify({
                lat: formattedPosition.coords.latitude,
                lng: formattedPosition.coords.longitude
            }));
            
            this._notifyListeners(formattedPosition);
            
            // If socket service is available, send update
            if (window.socketService && localStorage.getItem('userRole') === 'provider') {
                window.socketService.updateLocation({
                    lat: formattedPosition.coords.latitude,
                    lng: formattedPosition.coords.longitude
                });
            }
        }
    }

    /**
     * Handle position error from geolocation API
     * @param {PositionError} error - The error from geolocation API
     * @private
     */
    _handlePositionError(error) {
        console.error('Geolocation error:', error);
        
        if (error.code === error.PERMISSION_DENIED) {
            this.permissionDenied = true;
            this.stopTracking();
        }
        
        this._notifyError(error);
    }

    /**
     * Format position data for consistency
     * @param {Position} position - The position from geolocation API
     * @returns {Object} - Formatted position
     * @private
     */
    _formatPosition(position) {
        return {
            coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed
            },
            timestamp: position.timestamp,
            type: 'location-update'
        };
    }

    /**
     * Check if position has changed enough to warrant an update
     * @param {Position} position - The new position
     * @returns {boolean} - Whether to update the position
     * @private
     */
    _shouldUpdatePosition(position) {
        // Always update if no previous position
        if (!this.lastPosition) return true;
        
        // Skip if accuracy is poor (unless we haven't had a good reading in a while)
        if (this.batteryFriendly && position.coords.accuracy > this.minAccuracy) {
            return false;
        }
        
        // Calculate distance between positions
        const distance = this._calculateDistance(
            this.lastPosition.coords.latitude,
            this.lastPosition.coords.longitude,
            position.coords.latitude,
            position.coords.longitude
        );
        
        // Update if distance is greater than threshold or time since last update is large
        const timeDiff = position.timestamp - this.lastPosition.timestamp;
        const timeThreshold = 60000; // 1 minute
        
        return distance > this.trackingOptions.distanceFilter || timeDiff > timeThreshold;
    }

    /**
     * Calculate distance between two points in meters
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} - Distance in meters
     * @private
     */
    _calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    /**
     * Notify all location listeners of position update
     * @param {Object} position - The position to notify about
     * @private
     */
    _notifyListeners(position) {
        this.locationListeners.forEach(listener => {
            try {
                listener(position);
            } catch (error) {
                console.error('Error in location listener:', error);
            }
        });
    }

    /**
     * Notify all error listeners of an error
     * @param {Error} error - The error to notify about
     * @private
     */
    _notifyError(error) {
        this.errorListeners.forEach(listener => {
            try {
                listener(error);
            } catch (listenerError) {
                console.error('Error in error listener:', listenerError);
            }
        });
    }
}

// Create a global instance
window.locationTrackingService = new LocationTrackingService();
