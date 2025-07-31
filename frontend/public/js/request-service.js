class RequestService {
    constructor() {
        this.selectedLocation = null;
        this.selectedAddress = null;
        this.locationPickerMap = null;
        this.locationMarker = null;
        this.locationSearchBox = null;
    }

    // Initialize the request creation functionality
    init() {
        // Show/hide create request button based on user role
        const userRole = localStorage.getItem('userRole');
        const createRequestBtn = document.getElementById('createRequestBtn');
        if (createRequestBtn) {
            createRequestBtn.style.display = userRole === 'seeker' ? 'block' : 'none';
        }

        // Initialize maps when Google Maps API is fully loaded
        if (window.google && google.maps) {
            this.initLocationPicker();
        } else {
            // Wait for Google Maps to load
            window.initMapsCallback = () => {
                this.initLocationPicker();
            };
        }
    }

    // Initialize the location picker map
    initLocationPicker() {
        const mainMapElement = document.getElementById('locationMap');
        const pickerMapElement = document.getElementById('locationPickerMap');
        const searchInput = document.getElementById('locationSearchInput');
        
        // Initialize main map if element exists
        if (mainMapElement) {
            this.locationMap = new google.maps.Map(mainMapElement, {
                zoom: 15,
                center: { lat: 11.0168, lng: 76.9558 }, // Default to Coimbatore
                mapTypeControl: false,
                streetViewControl: false
            });
        }

        // Initialize picker map if element exists
        if (pickerMapElement) {
            this.locationPickerMap = new google.maps.Map(pickerMapElement, {
                zoom: 15,
                center: { lat: 11.0168, lng: 76.9558 },
                mapTypeControl: false,
                streetViewControl: false
            });

            // Initialize search box for the picker map
            if (searchInput) {
                const searchBox = new google.maps.places.SearchBox(searchInput);
                this.locationPickerMap.controls[google.maps.ControlPosition.TOP_LEFT].push(searchInput);

                // Bias the SearchBox results towards current map's viewport
                this.locationPickerMap.addListener('bounds_changed', () => {
                    searchBox.setBounds(this.locationPickerMap.getBounds());
                });

                // Listen for the event fired when the user selects a prediction
                searchBox.addListener('places_changed', () => {
                    const places = searchBox.getPlaces();
                    if (places.length === 0) return;

                    const place = places[0];
                    if (!place.geometry || !place.geometry.location) return;

                    // Center map and add marker
                    this.locationPickerMap.setCenter(place.geometry.location);
                    this.setLocationMarker(place.geometry.location);
                    this.selectedAddress = place.formatted_address;
                });
            }
        }

        // Try to get user's current location for initial position
        if (window.locationService) {
            window.locationService.getCurrentLocation({ requestPermission: true, highAccuracy: true })
                .then(position => {
                    const latLng = new google.maps.LatLng(position.lat, position.lng);
                    
                    // Update both maps if they exist
                    if (this.locationMap) {
                        this.locationMap.setCenter(latLng);
                        this.setLocationMarker(latLng, this.locationMap);
                    }
                    if (this.locationPickerMap) {
                        this.locationPickerMap.setCenter(latLng);
                        this.setLocationMarker(latLng, this.locationPickerMap);
                    }
                    
                    // Get and display address
                    window.locationService.getAddressFromCoordinates(latLng)
                        .then(result => {
                            if (result && result.formatted_address) {
                                this.selectedAddress = result.formatted_address;
                                if (searchInput) {
                                    searchInput.value = result.formatted_address;
                                }
                                const displayElement = document.getElementById('selectedLocationDisplay');
                                if (displayElement) {
                                    displayElement.textContent = result.formatted_address;
                                }
                            }
                        });
                })
                .catch(error => {
                    console.warn('Error getting initial location:', error);
                    // Show location permission request if needed
                    document.querySelector('.location-permission-info')?.style.display = 'block';
                });
        }
    }

    // Set or update the location marker
    setLocationMarker(latLng) {
        if (this.locationMarker) {
            this.locationMarker.setPosition(latLng);
        } else {
            this.locationMarker = new google.maps.Marker({
                position: latLng,
                map: this.locationPickerMap,
                draggable: true
            });
            
            // Add drag end listener to update address when marker is dragged
            this.locationMarker.addListener('dragend', () => {
                const newPos = this.locationMarker.getPosition();
                if (window.locationService) {
                    window.locationService.getAddressFromCoordinates(newPos)
                        .then(result => {
                            if (result && result.formatted_address) {
                                this.selectedAddress = result.formatted_address;
                                const searchInput = document.getElementById('locationSearchInput');
                                if (searchInput) {
                                    searchInput.value = result.formatted_address;
                                }
                            }
                        })
                        .catch(error => console.error('Error getting address:', error));
                }
            });
        }
        this.selectedLocation = latLng;
    }

    // Open the location picker modal
    openLocationPicker() {
        $('#locationPickerModal').modal('show');
        // Trigger resize to ensure map displays correctly
        setTimeout(() => {
            google.maps.event.trigger(this.locationPickerMap, 'resize');
            if (this.selectedLocation) {
                this.locationPickerMap.setCenter(this.selectedLocation);
            }
        }, 500);
    }

    // Confirm selected location
    confirmLocation() {
        if (this.selectedLocation) {
            const locationDisplay = document.getElementById('selectedLocation');
            if (locationDisplay) {
                locationDisplay.textContent = this.selectedAddress || 
                    `${this.selectedLocation.lat().toFixed(6)}, ${this.selectedLocation.lng().toFixed(6)}`;
            }
        }
        $('#locationPickerModal').modal('hide');
    }

    // Get address from location coordinates (reverse geocoding)
    getAddressFromLocation(latLng) {
        return new Promise((resolve, reject) => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: latLng }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    resolve(results[0].formatted_address);
                } else {
                    reject(new Error(`Geocoder failed due to: ${status}`));
                }
            });
        });
    }

    // Submit a new service request
    async submitRequest() {
        try {
            // Validate form
            const form = document.getElementById('serviceRequestForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // Get form values
            const category = document.getElementById('serviceCategory').value;
            const description = document.getElementById('description').value;
            const contactNumber = document.getElementById('contactNumber').value;
            const duration = document.getElementById('duration').value;
            const additionalDetails = document.getElementById('additionalDetails').value;

            // Validate location
            if (!this.selectedLocation) {
                alert('Please select a service location');
                return;
            }

            // Create request data
            const requestData = {
                category,
                description,
                contactNumber,
                validFor: parseInt(duration),
                additionalDetails,
                location: {
                    type: 'Point',
                    coordinates: [
                        this.selectedLocation.lng(),
                        this.selectedLocation.lat()
                    ]
                },
                address: this.selectedAddress
            };

            // Show loading state
            const submitBtn = document.querySelector('.modal-footer .btn-primary');
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Creating request...';

            // Send request to server
            const response = await fetch(`${API_BASE_URL}/api/service-requests/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error('Failed to create service request');
            }

            const result = await response.json();
            
            // Emit socket event for real-time updates
            if (window.socketService && window.socketService.socket) {
                window.socketService.socket.emit('newRequest', result);
            }

            // Add request marker to map
            if (window.mapService) {
                window.mapService.addRequestMarker(
                    result._id,
                    {
                        lat: result.location.coordinates[1],
                        lng: result.location.coordinates[0]
                    },
                    {
                        service: result.category,
                        status: result.status,
                        description: result.description
                    }
                );
            }

            // Close modal and show success message
            $('#requestModal').modal('hide');
            this.showNotification('Success', 'Service request created successfully');
            
            // Reset form
            form.reset();
            this.selectedLocation = null;
            this.selectedAddress = null;
            
            // Update request list if function exists
            if (typeof loadActiveRequests === 'function') {
                loadActiveRequests();
            }

        } catch (error) {
            console.error('Error creating request:', error);
            this.showNotification('Error', 'Failed to create service request');
        } finally {
            // Reset button state
            const submitBtn = document.querySelector('.modal-footer .btn-primary');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Submit Request';
            }
        }
    }
    
    // Show notification helper
    showNotification(title, message) {
        if (typeof showNotification === 'function') {
            // Use global function if available
            showNotification(title, message);
        } else if ('Notification' in window) {
            // Use browser notifications
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body: message });
                }
            });
        } else {
            // Fallback to alert
            alert(`${title}: ${message}`);
        }
    }
}

// Initialize the service
window.requestService = new RequestService();

// Define the backend API base URL
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://backend-itzsanthosh369s-projects.vercel.app';

// Helper functions
function openRequestModal() {
    $('#requestModal').modal('show');
}

function pickLocation() {
    window.requestService.openLocationPicker();
}

function confirmLocation() {
    window.requestService.confirmLocation();
}

function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                window.requestService.selectedLocation = new google.maps.LatLng(pos.lat, pos.lng);
                
                // Reverse geocode to get the address
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ location: pos }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        window.requestService.selectedAddress = results[0].formatted_address;
                        document.getElementById('selectedLocation').textContent = results[0].formatted_address;
                    } else {
                        document.getElementById('selectedLocation').textContent = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
                    }
                });
            },
            (error) => {
                console.error('Error getting location:', error);
                alert('Unable to get your current location. Please pick a location on the map.');
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please pick a location on the map.');
    }
}

function submitRequest() {
    window.requestService.submitRequest();
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.requestService.init();
});