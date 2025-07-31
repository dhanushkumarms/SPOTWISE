/**
 * SpotWise Location Service
 * Provides reusable location-related functionality for the SpotWise application
 */
class LocationService {
    constructor() {
        this.geocoder = null;
        this.defaultLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore, India
        this.lastLocation = null;
        this.permissionDenied = false;
    }

    /**
     * Initialize the location service
     */
    init() {
        this.geocoder = new google.maps.Geocoder();
        
        // Try to load stored location
        const storedLocation = localStorage.getItem('lastUserLocation');
        if (storedLocation) {
            try {
                this.lastLocation = JSON.parse(storedLocation);
            } catch (e) {
                console.warn('Failed to parse stored location');
            }
        }
    }

    /**
     * Get the user's current location
     * @param {Object} options - Additional options
     * @param {boolean} options.requestPermission - Whether to show the permission request UI if permissions are denied
     * @param {boolean} options.highAccuracy - Whether to request high accuracy location
     * @returns {Promise} A promise that resolves with the user's coordinates
     */
    getCurrentLocation(options = {}) {
        const defaults = {
            requestPermission: true,
            highAccuracy: true
        };

        const settings = { ...defaults, ...options };

        return new Promise((resolve, reject) => {
            // If permission was previously denied and we shouldn't request again, reject immediately
            if (this.permissionDenied && !settings.requestPermission) {
                reject(new Error('Location permission previously denied'));
                return;
            }

            if (!navigator.geolocation) {
                this.permissionDenied = true;
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }
            
            // Show loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'locationLoadingIndicator';
            loadingIndicator.innerHTML = `
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
            document.body.appendChild(loadingIndicator);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Remove loading indicator
                    const indicator = document.getElementById('locationLoadingIndicator');
                    if (indicator) indicator.remove();
                    
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Store the location for future use
                    this.lastLocation = location;
                    localStorage.setItem('lastUserLocation', JSON.stringify(location));
                    
                    resolve(location);
                },
                (error) => {
                    // Remove loading indicator
                    const indicator = document.getElementById('locationLoadingIndicator');
                    if (indicator) indicator.remove();
                    
                    console.warn('Geolocation error:', error);
                    
                    // Mark permission as denied if that's the error
                    if (error.code === error.PERMISSION_DENIED) {
                        this.permissionDenied = true;
                        
                        // If we should show the permission request UI
                        if (settings.requestPermission) {
                            this.showLocationPermissionRequest()
                                .then(() => {
                                    // Try again if user followed the instructions
                                    this.getCurrentLocation({ requestPermission: false })
                                        .then(resolve)
                                        .catch(reject);
                                })
                                .catch(() => {
                                    // User declined in our UI too, fallback to last known or default
                                    this.getFallbackLocation().then(resolve).catch(reject);
                                });
                            return;
                        }
                    }
                    
                    // Fallback to last known location or default
                    this.getFallbackLocation().then(resolve).catch(reject);
                },
                {
                    timeout: settings.highAccuracy ? 10000 : 5000,
                    enableHighAccuracy: settings.highAccuracy,
                    maximumAge: 60000 // 1 minute
                }
            );
        });
    }
    
    /**
     * Get fallback location (last known or default)
     * @returns {Promise} A promise that resolves with a location
     */
    getFallbackLocation() {
        return new Promise((resolve) => {
            // Use last known location if available
            if (this.lastLocation) {
                resolve(this.lastLocation);
                return;
            }
            
            // Otherwise use default location
            resolve(this.defaultLocation);
        });
    }
    
    /**
     * Show a UI to request location permission
     * @returns {Promise} A promise that resolves if user agrees, rejects if they decline
     */
    showLocationPermissionRequest() {
        return new Promise((resolve, reject) => {
            // Create modal HTML
            const modalHtml = `
                <div class="location-permission-modal" id="locationPermissionModal">
                    <div class="location-permission-content">
                        <h3>Location Access Needed</h3>
                        <p>SpotWise needs your location to provide nearby services. Please allow location access in your browser settings.</p>
                        <div class="browser-instructions">
                            <p><strong>How to enable location:</strong></p>
                            <ul>
                                <li>Click the lock/info icon in your browser's address bar</li>
                                <li>Find "Location" or "Site settings"</li>
                                <li>Change the permission to "Allow"</li>
                                <li>Refresh the page</li>
                            </ul>
                        </div>
                        <div class="location-permission-actions">
                            <button id="locationPermissionCancel" class="btn-secondary">Use Default Location</button>
                            <button id="locationPermissionConfirm" class="btn-primary">I've Enabled Location</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Add styles if not already present
            if (!document.getElementById('locationPermissionStyles')) {
                const styles = document.createElement('style');
                styles.id = 'locationPermissionStyles';
                styles.innerHTML = `
                    .location-permission-modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                    }
                    .location-permission-content {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        max-width: 500px;
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                    }
                    .browser-instructions {
                        background: #f5f5f5;
                        padding: 10px;
                        border-radius: 4px;
                        margin: 15px 0;
                    }
                    .location-permission-actions {
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                        margin-top: 20px;
                    }
                    .btn-primary {
                        background: #7335b7;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    .btn-secondary {
                        background: #f5f5f5;
                        border: 1px solid #ddd;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                `;
                document.head.appendChild(styles);
            }
            
            // Add event listeners
            document.getElementById('locationPermissionConfirm').addEventListener('click', () => {
                this.removeLocationPermissionModal();
                resolve();
            });
            
            document.getElementById('locationPermissionCancel').addEventListener('click', () => {
                this.removeLocationPermissionModal();
                reject(new Error('User declined location permission in UI'));
            });
        });
    }
    
    /**
     * Remove the location permission modal
     */
    removeLocationPermissionModal() {
        const modal = document.getElementById('locationPermissionModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Initialize Google Places Autocomplete on an input field
     * @param {HTMLElement} inputElement - The input element to attach autocomplete to
     * @param {Object} options - Autocomplete options
     * @param {Function} callback - Callback function when a place is selected
     * @returns {google.maps.places.Autocomplete} The autocomplete instance
     */
    initAutocomplete(inputElement, options = {}, callback = null) {
        const defaultOptions = {
            types: ['address'],
            componentRestrictions: { country: [] }        };

        const autocomplete = new google.maps.places.Autocomplete(
            inputElement,
            { ...defaultOptions, ...options }
        );

        if (callback) {
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry && place.geometry.location) {
                    callback(place);
                }
            });
        }

        return autocomplete;
    }

    /**
     * Convert coordinates to address (reverse geocoding)
     * @param {Object} latLng - The coordinates { lat, lng }
     * @returns {Promise} A promise that resolves with the address
     */
    getAddressFromCoordinates(latLng) {
        return new Promise((resolve, reject) => {
            if (!this.geocoder) {
                this.geocoder = new google.maps.Geocoder();
            }

            this.geocoder.geocode({ location: latLng }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    resolve(results[0]);
                } else {
                    reject(new Error(`Geocoder failed due to: ${status}`));
                }
            });
        });
    }

    /**
     * Convert address to coordinates (forward geocoding)
     * @param {string} address - The address to geocode
     * @returns {Promise} A promise that resolves with the coordinates
     */
    getCoordinatesFromAddress(address) {
        return new Promise((resolve, reject) => {
            if (!this.geocoder) {
                this.geocoder = new google.maps.Geocoder();
            }

            this.geocoder.geocode({ address: address }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    resolve(results[0].geometry.location);
                } else {
                    reject(new Error(`Geocoder failed due to: ${status}`));
                }
            });
        });
    }

    /**
     * Calculate distance between two points
     * @param {Object} origin - The origin coordinates { lat, lng }
     * @param {Object} destination - The destination coordinates { lat, lng }
     * @returns {number} Distance in kilometers
     */
    calculateDistanceInKm(origin, destination) {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(destination.lat - origin.lat);
        const dLng = this.deg2rad(destination.lng - origin.lng);
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(origin.lat)) * Math.cos(this.deg2rad(destination.lat)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // Distance in km
        
        return distance;
    }
    
    /**
     * Convert degrees to radians
     * @param {number} deg - Degrees
     * @returns {number} Radians
     */
    deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    /**
     * Extract address components from Google geocode result
     * @param {Object} result - Geocode result
     * @returns {Object} Structured address object
     */
    extractAddressComponents(result) {
        const addressInfo = {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: ''
        };

        if (!result || !result.address_components) return addressInfo;

        // Process address components
        for (const component of result.address_components) {
            const type = component.types[0];
            
            switch (type) {
                case 'street_number':
                    addressInfo.street = component.long_name;
                    break;
                case 'route':
                    addressInfo.street += addressInfo.street 
                        ? ' ' + component.long_name 
                        : component.long_name;
                    break;
                case 'locality':
                    addressInfo.city = component.long_name;
                    break;
                case 'administrative_area_level_1':
                    addressInfo.state = component.long_name;
                    break;
                case 'postal_code':
                    addressInfo.postalCode = component.long_name;
                    break;
                case 'country':
                    addressInfo.country = component.long_name;
                    break;
            }
        }

        // If street is empty but we have a formatted address, use that
        if (!addressInfo.street && result.formatted_address) {
            addressInfo.street = result.formatted_address;
        }

        return addressInfo;
    }
}

// Export the service
window.locationService = new LocationService();
