/**
 * SpotWise Service Hub
 * Handles service request creation, listing, acceptance and completion
 */

// SpotWise Service Hub Module
const SpotWiseServiceHub = (function() {
    // Private module variables
    let userRole = null;
    let selectedLocation = null;
    let locationMap = null;
    let locationPickerMap = null;
    let requestsMap = null;
    let jobLocationMap = null;
    let locationMarker = null;
    let requestMarkers = [];
    let activeRequest = null;
    let activeRequestTimer = null;
    let isProviderTracking = false;
    
    // Define the backend API base URL
    const API_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://backend-green-zeta-69.vercel.app';
    
    // Module object to hold public methods and properties
    const module = {};
    
    /****************************************
     * INITIALIZATION
     ****************************************/
    
    // Initialize when document is loaded
    function init() {
        checkAuthentication();
        setupEventListeners();
        initMaps();
        initLocationTracking();
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Service Request Form Submission
        const requestForm = document.getElementById('serviceRequestForm');
        if (requestForm) {
            requestForm.addEventListener('submit', handleRequestSubmission);
        }
        
        // Location Picker Button
        const pickLocationBtn = document.getElementById('pickLocationBtn');
        if (pickLocationBtn) {
            pickLocationBtn.addEventListener('click', openLocationPicker);
        }
        
        // Confirm Location Button
        const confirmLocationBtn = document.getElementById('confirmLocationBtn');
        if (confirmLocationBtn) {
            confirmLocationBtn.addEventListener('click', confirmSelectedLocation);
        }
        
        // Refresh Requests Button (Provider)
        const refreshBtn = document.getElementById('refreshRequestsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadAvailableRequests);
        }
        
        // Complete Job Button
        const completeJobBtn = document.getElementById('completeJobBtn');
        if (completeJobBtn) {
            completeJobBtn.addEventListener('click', completeActiveJob);
        }
        
        // View Active Job Button
        const viewActiveJobBtn = document.getElementById('viewActiveJobBtn');
        if (viewActiveJobBtn) {
            viewActiveJobBtn.addEventListener('click', () => {
                $('#current-tab').tab('show');
            });
        }
        
        // Accept Request Button
        const acceptRequestBtn = document.getElementById('acceptRequestBtn');
        if (acceptRequestBtn) {
            acceptRequestBtn.addEventListener('click', acceptSelectedRequest);
        }
        
        // Location Tracking Toggle (for providers)
        const trackingToggle = document.getElementById('trackingToggle');
        if (trackingToggle) {
            trackingToggle.addEventListener('change', toggleLocationTracking);
            
            // Set initial state from localStorage
            trackingToggle.checked = localStorage.getItem('locationTrackingEnabled') === 'true';
            
            // Update UI to match tracking state
            updateTrackingState(trackingToggle.checked);
        }
        
        // Battery friendly toggle
        const batteryFriendlyToggle = document.getElementById('batteryFriendlyToggle');
        if (batteryFriendlyToggle) {
            batteryFriendlyToggle.addEventListener('change', (e) => {
                if (window.locationTrackingService) {
                    window.locationTrackingService.setBatteryFriendly(e.target.checked);
                    localStorage.setItem('batteryFriendlyTracking', e.target.checked ? 'true' : 'false');
                }
            });
            
            // Set initial state from localStorage
            batteryFriendlyToggle.checked = localStorage.getItem('batteryFriendlyTracking') !== 'false';
        }
    }
    
    // Register listeners with the event service
    function registerEventListeners() {
        if (!window.eventService) {
            console.warn('Event service not available');
            return;
        }
        
        window.eventService.on('requestUpdated', (updatedRequest) => {
            // Handle request status update
            if (updatedRequest.status === 'in-progress' && userRole === 'seeker') {
                // Show notification with PIN
                showNotification(
                    'Request Accepted!', 
                    `A service provider has accepted your request. Your verification PIN is: ${updatedRequest.generatedPin}. Keep this PIN to verify when the service is completed.`,
                    'success'
                );
                
                // Refresh active requests to show the updated status and PIN
                loadUserActiveRequests();
            } else if (updatedRequest.status === 'completed') {
                // Handle completed request
                showNotification('Request Completed', 'Your service request has been marked as completed!', 'success');
                
                if (userRole === 'seeker') {
                    loadUserActiveRequests();
                } else if (userRole === 'provider') {
                    checkActiveJob();
                }
            }
        });
    }

    /****************************************
     * AUTHENTICATION & USER STATUS
     ****************************************/
    
    // Check authentication and show appropriate content
    function checkAuthentication() {
        const token = localStorage.getItem('token');
        
        if (!token) {
            // Show login required message
            document.getElementById('loginRequiredMessage').style.display = 'block';
            document.getElementById('seekerRole').style.display = 'none';
            document.getElementById('providerRole').style.display = 'none';
            return;
        }
        
        // Get user role
        userRole = localStorage.getItem('userRole');
        
        // Register event listeners after user role is determined
        registerEventListeners();
        
        if (userRole === 'seeker') {
            // Show seeker interface
            document.getElementById('loginRequiredMessage').style.display = 'none';
            document.getElementById('seekerRole').style.display = 'block';
            document.getElementById('providerRole').style.display = 'none';
            
            // Load active requests for seeker
            loadUserActiveRequests();
        } else if (userRole === 'provider') {
            // Show provider interface
            document.getElementById('loginRequiredMessage').style.display = 'none';
            document.getElementById('seekerRole').style.display = 'none';
            document.getElementById('providerRole').style.display = 'block';
            
            // Fetch the latest status from the backend
            fetchProviderStatus().then(() => {
                // Check provider status
                checkProviderStatus();
                
                // Load available requests
                loadAvailableRequests();
                
                // Check for active job
                checkActiveJob();
            });
        } else {
            // Unknown role - show login message
            document.getElementById('loginRequiredMessage').style.display = 'block';
            document.getElementById('seekerRole').style.display = 'none';
            document.getElementById('providerRole').style.display = 'none';
        }
    }
    
    // Fetch provider status from backend and update localStorage
    async function fetchProviderStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                console.warn('Failed to fetch provider status');
                // If we can't fetch, keep using the status from localStorage
                return;
            }
            
            const data = await response.json();
            
            // Update localStorage with the fetched status
            if (data.status) {
                localStorage.setItem('providerStatus', data.status);
            }
            
            return data.status;
        } catch (error) {
            console.error('Error fetching provider status:', error);
        }
    }
    
    // Check provider status
    function checkProviderStatus() {
        const status = localStorage.getItem('providerStatus');
        const statusAlert = document.getElementById('providerStatusAlert');
        
        if (!statusAlert) return;
        
        if (status === 'online') {
            // Provider is online
            statusAlert.className = 'alert alert-success';
            statusAlert.innerHTML = `
                <strong>You are online!</strong> You can now see and accept service requests in your area.
            `;
        } else if (status === 'in-progress') {
            // Provider has an active job
            statusAlert.className = 'alert alert-warning';
            statusAlert.innerHTML = `
                <strong>You have an active job!</strong> Complete your current job before accepting new requests.
            `;
            
            // Show active job alert
            const activeJobAlert = document.getElementById('activeJobAlert');
            if (activeJobAlert) {
                activeJobAlert.style.display = 'block';
            }
        } else if (status === 'active') {
            // Provider is actively searching - transitional state
            statusAlert.className = 'alert alert-info';
            statusAlert.innerHTML = `
                <strong>Finding a job...</strong> You are currently searching for a job.
            `;
        } else {
            // Provider is offline
            statusAlert.className = 'alert alert-warning';
            statusAlert.innerHTML = `
                <strong>You are currently offline.</strong> Toggle your status to "Online" in your profile to see and accept service requests.
                <a href="profile.html" class="btn btn-sm btn-outline-primary ml-2">Go to Profile</a>
            `;
        }
    }
    
    // Update provider status on the backend
    async function updateProviderStatusOnBackend(status) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                console.warn(`Failed to update status to ${status}`);
                return false;
            }
            
            // If changing status to offline, stop location tracking
            if (status === 'offline') {
                stopLocationTracking();
            }
            
            // If changing status to online and tracking was enabled, start tracking
            if (status === 'online' && localStorage.getItem('locationTrackingEnabled') === 'true') {
                startLocationTracking();
            }
            
            return true;
        } catch (error) {
            console.error('Error updating provider status:', error);
            return false;
        }
    }
    
    /****************************************
     * MAP FUNCTIONALITY
     ****************************************/
    
    // Initialize maps
    function initMaps() {
        // Initialize main location map (for seekers)
        const locationMapElement = document.getElementById('locationMap');
        if (locationMapElement && window.google && google.maps) {
            locationMap = new google.maps.Map(locationMapElement, {
                center: { lat: 12.9716, lng: 77.5946 }, // Default center (Bangalore)
                zoom: 13,
                mapTypeControl: false,
                streetViewControl: false
            });
            
            // Try to get user's current location
            if (window.locationService) {
                window.locationService.getCurrentLocation({ requestPermission: true, highAccuracy: true })
                    .then(position => {
                        selectedLocation = position;
                        
                        // Add marker for current location
                        if (locationMap) {
                            const latLng = new google.maps.LatLng(position.lat, position.lng);
                            locationMap.setCenter(latLng);
                            addLocationMarker(locationMap, latLng);
                            
                            // Get address for display
                            window.locationService.getAddressFromCoordinates(latLng)
                                .then(result => {
                                    if (result && result.formatted_address) {
                                        document.getElementById('selectedLocationDisplay').textContent = result.formatted_address;
                                    }
                                }).catch(error => {
                                    console.warn('Error getting address:', error);
                                    document.getElementById('selectedLocationDisplay').textContent = 
                                        `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
                                });
                        }
                    })
                    .catch(error => {
                        console.warn('Error getting location:', error);
                        document.getElementById('selectedLocationDisplay').textContent = 
                            'Could not detect your location. Please click "Change Location" to set your service location.';
                        
                        // Use fallback location from the location service if available
                        if (window.locationService) {
                            window.locationService.getFallbackLocation()
                                .then(defaultPosition => {
                                    selectedLocation = defaultPosition;
                                    
                                    if (locationMap) {
                                        const latLng = new google.maps.LatLng(defaultPosition.lat, defaultPosition.lng);
                                        locationMap.setCenter(latLng);
                                        addLocationMarker(locationMap, latLng);
                                    }
                                });
                        }
                    });
            }
        }
        
        // Initialize location picker map
        initializeLocationPickerMap();
        
        // Initialize requests map (for providers)
        const requestsMapElement = document.getElementById('requestMapContainer');
        if (requestsMapElement && window.mapService) {
            window.mapService.initMap('requestMapContainer').then(mapInstance => {
                requestsMap = mapInstance;
            }).catch(error => {
                console.error('Error initializing requests map:', error);
                showAlert('Warning', 'Could not initialize map. Some features may be limited.', 'warning');
            });
        }
        
        // Initialize job location map (for active jobs)
        const jobMapElement = document.getElementById('jobLocationMap');
        if (jobMapElement) {
            const centerLocation = selectedLocation || 
                                  (window.locationService && window.locationService.lastLocation) || 
                                  { lat: 12.9716, lng: 77.5946 };
            
            jobLocationMap = new google.maps.Map(jobMapElement, {
                center: centerLocation,
                zoom: 15
            });
        }
    }
    
    // Initialize location picker map
    function initializeLocationPickerMap() {
        const pickerMapElement = document.getElementById('locationPickerMap');
        if (pickerMapElement && window.google && google.maps) {
            // Use last known or default location as center
            const centerLocation = selectedLocation || 
                                (window.locationService && window.locationService.lastLocation) || 
                                { lat: 12.9716, lng: 77.5946 };
            
            locationPickerMap = new google.maps.Map(pickerMapElement, {
                center: centerLocation,
                zoom: 13,
                mapTypeControl: false,
                streetViewControl: false
            });
            
            // Add click listener
            locationPickerMap.addListener('click', (event) => {
                const clickedLocation = event.latLng;
                addLocationMarker(locationPickerMap, clickedLocation);
            });
            
            // Initialize search box
            const searchInput = document.getElementById('locationSearchInput');
            if (searchInput && window.locationService) {
                window.locationService.initAutocomplete(
                    searchInput,
                    { types: ['geocode'] },
                    (place) => {
                        if (place.geometry && place.geometry.location) {
                            locationPickerMap.setCenter(place.geometry.location);
                            addLocationMarker(locationPickerMap, place.geometry.location);
                        }
                    }
                );
            }
            
            // Try to set initial marker if we have a location
            if (selectedLocation) {
                const latLng = new google.maps.LatLng(selectedLocation.lat, selectedLocation.lng);
                addLocationMarker(locationPickerMap, latLng);
            }
        }
    }
    
    // Add or update location marker
    function addLocationMarker(map, location) {
        if (!map) return;
        
        // Convert to LatLng if needed
        if (typeof location.lat === 'number') {
            location = new google.maps.LatLng(location.lat, location.lng);
        }
        
        // Determine which marker we're updating based on the map
        const isPickerMap = (map === locationPickerMap);
        let marker = isPickerMap ? locationMarker : locationMarker;
        
        if (marker) {
            // Update existing marker
            marker.setPosition(location);
        } else {
            // Create new marker
            marker = new google.maps.Marker({
                position: location,
                map: map,
                draggable: true,
                animation: google.maps.Animation.DROP
            });
            
            // Add drag end listener
            marker.addListener('dragend', function() {
                const newPos = marker.getPosition();
                
                // Update selected location
                selectedLocation = {
                    lat: newPos.lat(),
                    lng: newPos.lng()
                };
                
                // Get address for the new position
                if (window.locationService) {
                    window.locationService.getAddressFromCoordinates(newPos)
                        .then(result => {
                            if (result && result.formatted_address) {
                                const searchInput = document.getElementById('locationSearchInput');
                                if (searchInput && isPickerMap) {
                                    searchInput.value = result.formatted_address;
                                }
                                
                                // Update the location display if this is the main map
                                if (!isPickerMap) {
                                    document.getElementById('selectedLocationDisplay').textContent = result.formatted_address;
                                }
                            }
                        }).catch(error => console.warn('Error getting address:', error));
                }
            });
            
            // Set the marker reference
            locationMarker = marker;
        }
        
        // Update selected location
        selectedLocation = {
            lat: location.lat(),
            lng: location.lng()
        };
    }
    
    // Open location picker modal
    function openLocationPicker() {
        // Make sure the map is initialized before showing
        if (!locationPickerMap) {
            initializeLocationPickerMap();
        }
        
        // Show the modal
        $('#locationPickerModal').modal('show');
        
        // Trigger resize to ensure map displays correctly
        setTimeout(() => {
            if (locationPickerMap) {
                google.maps.event.trigger(locationPickerMap, 'resize');
                
                // Center map on current selected location
                if (selectedLocation) {
                    locationPickerMap.setCenter(selectedLocation);
                }
                
                // Make sure marker is visible
                if (!locationMarker && selectedLocation) {
                    const latLng = new google.maps.LatLng(selectedLocation.lat, selectedLocation.lng);
                    addLocationMarker(locationPickerMap, latLng);
                }
            }
        }, 300);
    }
    
    // Confirm selected location from picker
    function confirmSelectedLocation() {
        if (!selectedLocation) {
            alert('Please select a location on the map');
            return;
        }
        
        // Update main map with selected location
        if (locationMap) {
            locationMap.setCenter(selectedLocation);
            addLocationMarker(locationMap, new google.maps.LatLng(selectedLocation.lat, selectedLocation.lng));
            
            // Get address for display
            if (window.locationService) {
                window.locationService.getAddressFromCoordinates(new google.maps.LatLng(selectedLocation.lat, selectedLocation.lng))
                    .then(result => {
                        if (result && result.formatted_address) {
                            document.getElementById('selectedLocationDisplay').textContent = result.formatted_address;
                        } else {
                            document.getElementById('selectedLocationDisplay').textContent = 
                                `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
                        }
                    }).catch(error => {
                        console.warn('Error getting address:', error);
                        document.getElementById('selectedLocationDisplay').textContent = 
                            `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
                    });
            } else {
                document.getElementById('selectedLocationDisplay').textContent = 
                    `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
            }
        }
        
        // Add a line to store this in the database for seekers
        if (userRole === 'seeker' && window.socketService) {
            window.socketService.emitWithErrorHandling('updateSeekerLocation', {
                location: {
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng
                }
            });
        }
        
        // Close the modal
        $('#locationPickerModal').modal('hide');
    }
    
    // Function to use current location
    function useCurrentLocation() {
        if (window.locationService) {
            window.locationService.getCurrentLocation({ requestPermission: true, highAccuracy: true })
                .then(position => {
                    const latLng = new google.maps.LatLng(position.lat, position.lng);
                    
                    // Update location picker map if open
                    if (locationPickerMap) {
                        locationPickerMap.setCenter(latLng);
                        addLocationMarker(locationPickerMap, latLng);
                    }
                    
                    // Update main location map
                    if (locationMap) {
                        locationMap.setCenter(latLng);
                        addLocationMarker(locationMap, latLng);
                    }
                    
                    // Update selected location display
                    if (window.locationService) {
                        window.locationService.getAddressFromCoordinates(latLng)
                            .then(result => {
                                if (result && result.formatted_address) {
                                    const searchInput = document.getElementById('locationSearchInput');
                                    if (searchInput) {
                                        searchInput.value = result.formatted_address;
                                    }
                                    document.getElementById('selectedLocationDisplay').textContent = result.formatted_address;
                                }
                            }).catch(error => console.warn('Error getting address:', error));
                    }
                })
                .catch(error => {
                    console.warn('Could not get current location:', error);
                    alert('Could not access your location. Please pick a location manually.');
                });
        } else {
            // Fallback to browser's geolocation API
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const pos = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        
                        const latLng = new google.maps.LatLng(pos.lat, pos.lng);
                        
                        // Update location picker map if open
                        if (locationPickerMap) {
                            locationPickerMap.setCenter(latLng);
                            addLocationMarker(locationPickerMap, latLng);
                        }
                        
                        // Update main location map
                        if (locationMap) {
                            locationMap.setCenter(latLng);
                            addLocationMarker(locationMap, latLng);
                        }
                        
                        // Update display
                        document.getElementById('selectedLocationDisplay').textContent = 
                            `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
                    },
                    (error) => {
                        console.warn('Error getting location:', error);
                        alert('Unable to get your current location. Please pick a location on the map.');
                    }
                );
            } else {
                alert('Geolocation is not supported by your browser. Please pick a location on the map.');
            }
        }
        
        // Add a line to store this in the database for seekers
        if (userRole === 'seeker' && selectedLocation && window.socketService) {
            window.socketService.emitWithErrorHandling('updateSeekerLocation', {
                location: {
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng
                }
            });
        }
    }
    
    /****************************************
     * REQUEST HANDLING
     ****************************************/
    
    // Handle service request form submission
    async function handleRequestSubmission(e) {
        e.preventDefault();
        
        if (!selectedLocation) {
            alert('Please select a service location');
            return;
        }
        
        // Show loading
        document.getElementById('createRequestLoading').style.display = 'block';
        document.getElementById('submitRequestBtn').disabled = true;
        
        try {
            const category = document.getElementById('category').value;
            const description = document.getElementById('description').value;
            const contactNumber = document.getElementById('contactNumber').value;
            const duration = document.getElementById('duration').value;
            const additionalDetails = document.getElementById('additionalDetails').value;
            
            // Create request object
            const requestData = {
                category,
                description,
                contactNumber,
                duration: parseInt(duration),
                additionalDetails,
                location: {
                    type: 'Point',
                    coordinates: [selectedLocation.lng, selectedLocation.lat]
                }
            };
            
            // Send request to backend
            const response = await fetch(`${API_BASE_URL}/api/service-requests/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create service request');
            }
            
            const result = await response.json();
            
            // Reset form
            document.getElementById('serviceRequestForm').reset();
            
            // Show success message
            showAlert('Success', 'Service request created successfully!', 'success');
            
            // Switch to active requests tab
            setTimeout(() => {
                $('#active-tab').tab('show');
                loadUserActiveRequests();
            }, 1000);
            
        } catch (error) {
            console.error('Error creating request:', error);
            showAlert('Error', error.message || 'Failed to create service request', 'danger');
        } finally {
            // Hide loading
            document.getElementById('createRequestLoading').style.display = 'none';
            document.getElementById('submitRequestBtn').disabled = false;
        }
    }
    
    // Load user's active requests (for seekers)
    async function loadUserActiveRequests() {
        const container = document.getElementById('activeRequestsContainer');
        
        if (!container) return;
        
        // Show loading
        document.getElementById('activeRequestsLoading').style.display = 'block';
        container.style.display = 'none';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/service-requests/history`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load your requests');
            }
            
            const data = await response.json();
            const activeRequests = data.history.filter(request => 
                ['pending', 'in-progress'].includes(request.status)
            );
            
            // Display empty state if no active requests
            if (activeRequests.length === 0) {
                document.getElementById('emptyActiveRequests').style.display = 'block';
                container.innerHTML = '';
                return;
            }
            
            // Hide empty state
            document.getElementById('emptyActiveRequests').style.display = 'none';
            
            // Build requests HTML
            let html = '';
            
            activeRequests.forEach(request => {
                // Calculate time remaining for pending requests
                let timeRemaining = '';
                if (request.status === 'pending' && request.expirationTime) {
                    const expiryTime = new Date(request.expirationTime);
                    const now = new Date();
                    const diffMs = expiryTime - now;
                    
                    if (diffMs > 0) {
                        const diffMins = Math.floor(diffMs / 60000);
                        timeRemaining = `<span class="timer">Expires in ${diffMins} minute${diffMins !== 1 ? 's' : ''}</span>`;
                    } else {
                        timeRemaining = '<span class="timer">Expired</span>';
                    }
                }
                
                html += `
                    <div class="request-card" data-id="${request._id}">
                        <div class="card-header">
                            <span class="category-badge">${request.category}</span>
                            <span class="status-badge status-${request.status}">${formatStatus(request.status)}</span>
                        </div>
                        <div class="card-body">
                            <p><strong>Description:</strong> ${request.description}</p>
                            <p><strong>Contact:</strong> ${request.contactNumber}</p>
                            ${request.additionalDetails ? `<p><strong>Additional Details:</strong> ${request.additionalDetails}</p>` : ''}
                            ${request.provider ? `
                                <p><strong>Provider:</strong> ${request.provider.name || 'Assigned Provider'}</p>
                                <p><strong>Provider Contact:</strong> ${request.provider.contactNumber || 'N/A'}</p>
                            ` : ''}
                            <p><strong>Created:</strong> ${formatDate(request.createdAt)}</p>
                            ${timeRemaining ? `<p>${timeRemaining}</p>` : ''}
                            
                            ${request.status === 'in-progress' && request.generatedPin ? `
                                <div class="alert alert-info mt-3">
                                    <h5 class="mb-2"><i class="fa fa-key"></i> Verification PIN</h5>
                                    <div class="pin-display-box text-center p-2 mb-2" style="background: #f8f9fa; border-radius: 4px;">
                                        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${request.generatedPin}</span>
                                    </div>
                                    <p class="mb-0 small">Share this PIN with the provider when service is completed</p>
                                </div>
                            ` : ''}
                        </div>
                        <div class="request-actions">
                            ${request.status === 'pending' ? `
                                <button class="btn btn-sm btn-danger" onclick="cancelRequest('${request._id}')">Cancel</button>
                            ` : ''}
                            ${request.status === 'in-progress' && request.generatedPin ? `
                                <button class="btn btn-sm btn-info" onclick="showPin('${request.generatedPin}')">Show PIN</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            
            // Update container
            container.innerHTML = html;
            container.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading active requests:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load your requests. Please try again later.
                </div>
            `;
            container.style.display = 'block';
        } finally {
            // Hide loading
            document.getElementById('activeRequestsLoading').style.display = 'none';
        }
    }
    
    // Load available service requests (for providers)
    async function loadAvailableRequests() {
        // Check if provider is online
        const status = localStorage.getItem('providerStatus');
        
        if (status !== 'online') {
            // Provider is not online
            document.getElementById('availableRequestsContainer').innerHTML = `
                <div class="alert alert-warning">
                    You must be online to view available requests. Please update your status in your profile.
                </div>
            `;
            return;
        }
        
        const container = document.getElementById('availableRequestsContainer');
        
        if (!container) return;
        
        // Show loading
        document.getElementById('availableRequestsLoading').style.display = 'block';
        container.style.display = 'none';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/service-requests/active`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load available requests');
            }
            
            const requests = await response.json();
            
            // Clear existing markers
            clearRequestMarkers();
            
            // Display empty state if no requests
            if (!requests || requests.length === 0) {
                document.getElementById('emptyAvailableRequests').style.display = 'block';
                container.innerHTML = '';
                return;
            }
            
            // Hide empty state
            document.getElementById('emptyAvailableRequests').style.display = 'none';
            
            // Build requests HTML
            let html = '';
            
            requests.forEach(request => {
                // Calculate time remaining
                let timeRemaining = '';
                if (request.expirationTime) {
                    const expiryTime = new Date(request.expirationTime);
                    const now = new Date();
                    const diffMs = expiryTime - now;
                    
                    if (diffMs > 0) {
                        const diffMins = Math.floor(diffMs / 60000);
                        timeRemaining = `<span class="timer">Expires in ${diffMins} minute${diffMins !== 1 ? 's' : ''}</span>`;
                    }
                }
                
                html += `
                    <div class="request-card" data-id="${request._id}">
                        <div class="card-header">
                            <span class="category-badge">${request.category}</span>
                            <span class="status-badge status-pending">Available</span>
                        </div>
                        <div class="card-body">
                            <p><strong>Description:</trong> ${request.description}</p>
                            <p><strong>Client:</strong> ${request.seeker.userName}</p>
                            ${request.additionalDetails ? `<p><strong>Additional Details:</strong> ${request.additionalDetails}</p>` : ''}
                            <p><strong>Created:</strong> ${formatDate(request.createdAt)}</p>
                            ${timeRemaining ? `<p>${timeRemaining}</p>` : ''}
                        </div>
                        <div class="request-actions">
                            <button class="btn btn-sm btn-info" onclick="viewRequestDetails('${request._id}')">View Details</button>
                            <button class="btn btn-sm btn-accept" onclick="acceptRequest('${request._id}')">Accept Request</button>
                        </div>
                    </div>
                `;
                
                // Add marker to map
                addRequestMarker(request);
            });
            
            // Update container
            container.innerHTML = html;
            container.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading available requests:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load available requests. Please try again later.
                </div>
            `;
            container.style.display = 'block';
        } finally {
            // Hide loading
            document.getElementById('availableRequestsLoading').style.display = 'none';
        }
    }
    
    // Add request marker to map
    function addRequestMarker(request) {
        if (!requestsMap || !request.location || !request.location.coordinates) return;
        
        // Create marker position
        const position = {
            lat: request.location.coordinates[1],
            lng: request.location.coordinates[0]
        };
        
        // Create marker
        const marker = new google.maps.Marker({
            position: position,
            map: requestsMap,
            title: `${request.category} Request`,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#FF6F00",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#FFFFFF"
            },
            animation: google.maps.Animation.DROP
        });
        
        // Create info window
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div class="info-window">
                    <h5>${request.category}</h5>
                    <p>${request.description}</p>
                    <button class="btn btn-sm btn-primary info-window-btn" onclick="viewRequestDetails('${request._id}')">View Details</button>
                </div>
            `
        });
        
        // Add click listener
        marker.addListener('click', () => {
            // Close all open info windows
            requestMarkers.forEach(m => {
                if (m.infoWindow) m.infoWindow.close();
            });
            
            // Open this info window
            infoWindow.open(requestsMap, marker);
        });
        
        // Store marker in array
        requestMarkers.push({
            id: request._id,
            marker: marker,
            infoWindow: infoWindow
        });
    }
    
    // Clear request markers from map
    function clearRequestMarkers() {
        requestMarkers.forEach(m => {
            m.marker.setMap(null);
            if (m.infoWindow) m.infoWindow.close();
        });
        
        requestMarkers = [];
    }
    
    // View request details
    function viewRequestDetails(requestId) {
        // Find request in DOM
        const requestCard = document.querySelector(`.request-card[data-id="${requestId}"]`);
        
        if (!requestCard) {
            alert('Request details not found');
            return;
        }
        
        // Set current request ID for acceptance
        document.getElementById('acceptRequestBtn').dataset.requestId = requestId;
        
        // Get request content
        const content = requestCard.innerHTML;
        
        // Set modal content
        document.getElementById('requestDetailsContent').innerHTML = content;
        
        // Show modal
        $('#requestDetailsModal').modal('show');
    }
    
    // Accept selected request
    function acceptSelectedRequest() {
        const requestId = document.getElementById('acceptRequestBtn').dataset.requestId;
        
        if (!requestId) {
            alert('No request selected');
            return;
        }
        
        // Close modal
        $('#requestDetailsModal').modal('hide');
        
        // Accept request
        acceptRequest(requestId);
    }
    
    // Accept a service request
    async function acceptRequest(requestId) {
        // Check if provider is online
        const status = localStorage.getItem('providerStatus');
        
        if (status !== 'online') {
            showAlert('Error', 'You must be online to accept requests', 'danger');
            return;
        }
        
        try {
            // Show loading overlay
            const loadingEl = document.getElementById('availableRequestsLoading');
            if (loadingEl) loadingEl.style.display = 'block';
            
            // Set status to 'active' temporarily while accepting request
            await updateProviderStatusOnBackend('active');
            localStorage.setItem('providerStatus', 'active');
            
            const response = await fetch(`${API_BASE_URL}/api/service-requests/accept/${requestId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                // If error, revert to online status
                await updateProviderStatusOnBackend('online');
                localStorage.setItem('providerStatus', 'online');
                
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to accept request');
            }
            
            const result = await response.json();
            
            // Update provider status in localStorage and backend to in-progress
            await updateProviderStatusOnBackend('in-progress');
            localStorage.setItem('providerStatus', 'in-progress');
            
            // Show success message
            showAlert('Success', 'Request accepted successfully!', 'success');
            
            // Update provider status UI
            checkProviderStatus();
            
            // Load the active job
            checkActiveJob();
            
            // Switch to current job tab
            setTimeout(() => {
                const currentTab = document.getElementById('current-tab');
                if (currentTab) {
                    $('#current-tab').tab('show');
                }
            }, 1000);
            
        } catch (error) {
            console.error('Error accepting request:', error);
            showAlert('Error', error.message || 'Failed to accept request', 'danger');
        } finally {
            // Hide loading overlay
            const loadingEl = document.getElementById('availableRequestsLoading');
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }
    
    // Check for active job
    async function checkActiveJob() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/service-requests/history`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to check active job');
            }
            
            const data = await response.json();
            const activeJobs = data.history.filter(request => request.status === 'in-progress');
            
            // Display active job if found
            if (activeJobs.length > 0) {
                // Show active job alert
                document.getElementById('activeJobAlert').style.display = 'block';
                
                // Set active request
                activeRequest = activeJobs[0];
                
                // Display job details
                displayActiveJob(activeRequest);
            } else {
                // Hide active job alert
                document.getElementById('activeJobAlert').style.display = 'none';
                
                // Show no active job message
                document.getElementById('noActiveJobMessage').style.display = 'block';
                document.getElementById('activeJobDetails').style.display = 'none';
                
                // Clear active request
                activeRequest = null;
            }
            
        } catch (error) {
            console.error('Error checking active job:', error);
        }
    }
    
    // Display active job details
    function displayActiveJob(request) {
        // Hide no active job message
        document.getElementById('noActiveJobMessage').style.display = 'none';
        
        // Create job details HTML
        const jobDetailsContainer = document.getElementById('activeJobDetails');
        
        jobDetailsContainer.innerHTML = `
            <div class="job-details-card">
                <h4 class="mb-3">${request.category} Service</h4>
                
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        Client Details
                    </div>
                    <div class="card-body">
                        <p><strong>Client:</strong> ${request.seeker.name || 'Client'}</p>
                        <p><strong>Contact:</strong> ${request.contactNumber}</p>
                    </div>
                </div>
                
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        Job Details
                    </div>
                    <div class="card-body">
                        <p><strong>Description:</strong> ${request.description}</p>
                        ${request.additionalDetails ? `<p><strong>Additional Details:</strong> ${request.additionalDetails}</p>` : ''}
                        <p><strong>Status:</strong> <span class="badge badge-info">In Progress</span></p>
                        <p><strong>Accepted at:</strong> ${formatDate(request.updatedAt)}</p>
                    </div>
                </div>
            </div>
        `;
        
        // Show job details
        jobDetailsContainer.style.display = 'block';
        
        // Set job location on map
        if (jobLocationMap && request.location && request.location.coordinates) {
            const position = {
                lat: request.location.coordinates[1],
                lng: request.location.coordinates[0]
            };
            
            // Center map on job location
            jobLocationMap.setCenter(position);
            
            // Add marker
            const marker = new google.maps.Marker({
                position: position,
                map: jobLocationMap,
                title: 'Job Location',
                animation: google.maps.Animation.DROP
            });
            
            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div class="info-window">
                        <h5>Job Location</h5>
                        <p>${request.category} service</p>
                    </div>
                `
            });
            
            // Open info window
            infoWindow.open(jobLocationMap, marker);
        }
    }
    
    // Complete active job
    async function completeActiveJob() {
        if (!activeRequest) {
            showAlert('Error', 'No active job found', 'danger');
            return;
        }
        
        const pin = document.getElementById('verificationPin').value.trim();
        
        if (!pin || pin.length !== 6) {
            showAlert('Error', 'Please enter a valid 6-digit PIN', 'danger');
            return;
        }
        
        try {
            // Show loading by disabling button
            const completeBtn = document.getElementById('completeJobBtn');
            completeBtn.disabled = true;
            completeBtn.textContent = 'Processing...';
            
            const response = await fetch(`${API_BASE_URL}/api/service-requests/complete/${activeRequest._id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ pin }) // Parameter name now matches backend
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to complete job');
            }
            
            // Update provider status back to online after job completion
            await updateProviderStatusOnBackend('online');
            localStorage.setItem('providerStatus', 'online');
            
            // Show success message
            showAlert('Success', 'Job completed successfully!', 'success');
            
            // Update UI
            checkProviderStatus();
            checkActiveJob();
            
            // Clear PIN input
            document.getElementById('verificationPin').value = '';
            
            // Switch to available tab after delay
            setTimeout(() => {
                $('#available-tab').tab('show');
                loadAvailableRequests();
            }, 2000);
            
        } catch (error) {
            console.error('Error completing job:', error);
            showAlert('Error', error.message || 'Failed to complete job. Please check the PIN and try again.', 'danger');
        } finally {
            // Reset button
            const completeBtn = document.getElementById('completeJobBtn');
            completeBtn.disabled = false;
            completeBtn.textContent = 'Verify & Complete';
        }
    }
    
    // Add a dedicated function to fetch PIN if needed
    async function fetchRequestPin(requestId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/service-requests/pin/${requestId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch PIN');
            }
            
            const data = await response.json();
            return data.generatedPin;
            
        } catch (error) {
            console.error('Error fetching PIN:', error);
            showAlert('Error', 'Could not retrieve verification PIN', 'danger');
            return null;
        }
    }
    
    // Cancel a service request
    async function cancelRequest(requestId) {
        if (!confirm('Are you sure you want to cancel this request?')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/service-requests/cancel/${requestId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to cancel request');
            }
            
            // Show success message
            showAlert('Success', 'Request cancelled successfully!', 'success');
            
            // Refresh active requests
            loadUserActiveRequests();
            
        } catch (error) {
            console.error('Error cancelling request:', error);
            showAlert('Error', error.message || 'Failed to cancel request', 'danger');
        }
    }
    
    // Show PIN to user
    function showPin(pin) {
        if (!pin) {
            showAlert('Error', 'No PIN available for this request', 'danger');
            return;
        }
        
        Swal.fire({
            title: 'Verification PIN',
            html: `<div class="text-center">
                    <div style="font-size: 32px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">${pin}</div>
                    <p>Share this PIN with the service provider when they complete the service.</p>
                  </div>`,
            icon: 'info',
            confirmButtonText: 'Got it!'
        });
    }
    
    /****************************************
     * UTILITIES
     ****************************************/
    
    // Helper function to format request status
    function formatStatus(status) {
        switch (status) {
            case 'pending':
                return 'Pending';
            case 'in-progress':
                return 'In Progress';
            case 'completed':
                return 'Completed';
            case 'cancelled':
                return 'Cancelled';
            case 'expired':
                return 'Expired';
            default:
                return status.charAt(0).toUpperCase() + status.slice(1);
        }
    }
    
    // Helper function to format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }
    
    // Helper function to show alerts
    function showAlert(title, message, type) {
        // Use SweetAlert if available
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                text: message,
                icon: type === 'success' ? 'success' : type === 'danger' ? 'error' : 'warning',
                timer: 3000,
                timerProgressBar: true
            });
        } else {
            // Create alert element
            const alertElement = document.createElement('div');
            alertElement.className = `alert alert-${type} alert-dismissible fade show`;
            alertElement.innerHTML = `
                <strong>${title}:</strong> ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            `;
            
            // Find a suitable container
            let container = document.querySelector('.alert-container') || 
                             document.querySelector('..container') || 
                             document.body;
            
            // Prepend alert to container
            container.prepend(alertElement);
            
            // Auto dismiss after 5 seconds
            setTimeout(() => {
                alertElement.classList.remove('show');
                setTimeout(() => alertElement.remove(), 150); 
            }, 5000);
        }
    }
    
    // Show notification helper function
    function showNotification(title, message, type = 'info') {
        // Use SweetAlert2 if available
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                text: message,
                icon: type,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000,
                timerProgressBar: true
            });
        } 
        // Use browser notification if permitted
        else if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/img/logo.png'
            });
        } 
        // Otherwise use alert
        else {
            showAlert(title, message, type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info');
        }
    }
    
    // Initialize location tracking
    function initLocationTracking() {
        if (userRole !== 'provider') return;
        
        // Check if tracking was previously enabled
        const trackingEnabled = localStorage.getItem('locationTrackingEnabled') === 'true';
        const providerStatus = localStorage.getItem('providerStatus');
        
        // Only start tracking if provider is online and tracking was enabled
        if (trackingEnabled && providerStatus === 'online') {
            startLocationTracking();
        }
        
        // Set up tracking status indicators
        updateTrackingState(trackingEnabled);
    }
    
    // Toggle location tracking
    function toggleLocationTracking(e) {
        const isEnabled = e.target.checked;
        
        if (isEnabled) {
            startLocationTracking();
        } else {
            stopLocationTracking();
        }
        
        // Save preference
        localStorage.setItem('locationTrackingEnabled', isEnabled ? 'true' : 'false');
        
        // Update UI
        updateTrackingState(isEnabled);
    }
    
    // Start location tracking
    function startLocationTracking() {
        if (window.locationTrackingService && !isProviderTracking) {
            // Get battery friendly setting
            const batteryFriendly = localStorage.getItem('batteryFriendlyTracking') !== 'false';
            
            window.locationTrackingService.startTracking({
                enableHighAccuracy: !batteryFriendly
            }).then(position => {
                console.log('Location tracking started successfully');
                isProviderTracking = true;
                
                // Set up location update listener
                window.locationTrackingService.addLocationListener(handleLocationUpdate);
                
                // Set up error listener
                window.locationTrackingService.addErrorListener(handleLocationError);
                
            }).catch(error => {
                console.error('Failed to start location tracking:', error);
                showAlert('Location Error', 'Failed to start location tracking. Please check your location permissions.', 'danger');
                
                // Reset toggle if it exists
                const trackingToggle = document.getElementById('trackingToggle');
                if (trackingToggle) {
                    trackingToggle.checked = false;
                }
                
                localStorage.setItem('locationTrackingEnabled', 'false');
                updateTrackingState(false);
            });
        }
    }
    
    // Stop location tracking
    function stopLocationTracking() {
        if (window.locationTrackingService && isProviderTracking) {
            window.locationTrackingService.stopTracking();
            isProviderTracking = false;
        }
    }
    
    // Update tracking state UI
    function updateTrackingState(isTracking) {
        const trackingStatus = document.getElementById('trackingStatus');
        if (trackingStatus) {
            trackingStatus.className = isTracking ? 'text-success' : 'text-secondary';
            trackingStatus.innerHTML = isTracking 
                ? '<i class="fa fa-map-marker"></i> Location tracking active'
                : '<i class="fa fa-map-marker"></i> Location tracking off';
        }
        
        const trackingSettingsDiv = document.getElementById('trackingSettings');
        if (trackingSettingsDiv) {
            trackingSettingsDiv.style.display = isTracking ? 'block' : 'none';
        }
    }
    
    // Handle location updates
    function handleLocationUpdate(position) {
        // Update your current position on the map if needed
        if (window.mapService && position && position.coords) {
            window.mapService.addCurrentLocationMarker({
                lat: position.coords.latitude, 
                lng: position.coords.longitude
            });
        }
        
        // Update accuracy display
        const accuracyDisplay = document.getElementById('locationAccuracy');
        if (accuracyDisplay && position && position.coords && position.coords.accuracy) {
            accuracyDisplay.textContent = `±${Math.round(position.coords.accuracy)} meters`;
        }
        
        // Update last updated time
        const lastUpdatedDisplay = document.getElementById('lastLocationUpdate');
        if (lastUpdatedDisplay) {
            lastUpdatedDisplay.textContent = new Date().toLocaleTimeString();
        }
        
        // If this is a provider and they're online, send the update to the server
        const userRole = localStorage.getItem('userRole');
        const providerStatus = localStorage.getItem('providerStatus');
        
        if (userRole === 'provider' && providerStatus === 'online' && window.socketService && position.type === 'location-update') {
            window.socketService.updateLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });
        }
    }
    
    // Handle location errors
    function handleLocationError(error) {
        console.error('Location error:', error);
        
        const errorDisplay = document.getElementById('locationErrorDisplay');
        if (errorDisplay) {
            errorDisplay.style.display = 'block';
            errorDisplay.innerHTML = `<i class="fa fa-exclamation-triangle"></i> ${error.message || 'Location error'}`;
        }
        
        if (error.code === 1) { // PERMISSION_DENIED
            showAlert('Location Permission Denied', 'Please enable location services to use tracking features.', 'warning');
            
            // Reset toggle if it exists
            const trackingToggle = document.getElementById('trackingToggle');
            if (trackingToggle) {
                trackingToggle.checked = false;
            }
            
            localStorage.setItem('locationTrackingEnabled', 'false');
            updateTrackingState(false);
        }
    }
    
    // Initialize the module when DOM content is loaded
    document.addEventListener('DOMContentLoaded', init);
    
    // Expose public methods
    module.viewRequestDetails = viewRequestDetails;
    module.acceptRequest = acceptRequest;
    module.cancelRequest = cancelRequest;
    module.showPin = showPin;
    module.useCurrentLocation = useCurrentLocation;
    module.toggleLocationTracking = toggleLocationTracking;
    module.startLocationTracking = startLocationTracking;
    module.stopLocationTracking = stopLocationTracking;
    
    return module;
})();

// Assign globally accessible functions
window.viewRequestDetails = SpotWiseServiceHub.viewRequestDetails;
window.acceptRequest = SpotWiseServiceHub.acceptRequest;
window.cancelRequest = SpotWiseServiceHub.cancelRequest;
window.showPin = SpotWiseServiceHub.showPin;
window.useCurrentLocation = SpotWiseServiceHub.useCurrentLocation;
window.toggleLocationTracking = SpotWiseServiceHub.toggleLocationTracking;