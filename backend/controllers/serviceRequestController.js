const ServiceRequest = require('../models/ServiceRequestModel');
const User = require('../models/UserModel');

// Create a new service request
exports.createRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(userId)
        const { category, description, contactNumber, location, duration, additionalDetails } = req.body;
        
        // Ensure user is a seeker
        if (req.user.role !== 'seeker') {
            return res.status(403).json({ message: 'Only seekers can create service requests' });
        }

        const newRequest = new ServiceRequest({
            seeker: userId,
            category,
            description,
            contactNumber, // Use contactNumber from request body
            location,
            duration, // Ensure duration is provided
            additionalDetails,
        });
        console.log(req.user)
        

        const savedRequest = await newRequest.save();
        res.status(201).json(savedRequest);
    } catch (error) {
        console.error('Error creating service request:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Fetch all active service requests (visible to providers based on skills)
exports.getActiveRequests = async (req, res) => {
    try {
        if (req.user.role !== 'provider') {
            return res.status(403).json({ message: 'Only providers can view service requests' });
        }
        const user = await User.findById(req.user.id).select('-password')
        const skills = user.skills;
        const location = user.location;
        console.log('User Location:', location); // Add this line to debug
        console.log(skills)
        const radius = 1000; // Radius in kilometers
         // Check provider's status
         if (user.status === 'in-progress') {
            return res.status(400).json({ message: 'You have an ongoing request in progress.' });
        }

        // Check if location is defined
        if (!location || !location.coordinates || location.coordinates.length !== 2) {
            return res.status(400).json({ message: 'Invalid location' });
        }

        // Fetch active requests within range and matching provider skills
        const activeRequests = await ServiceRequest.find({
            category: { $in: skills },
            location: {
                $geoWithin: {
                    $centerSphere: [
                        [location.coordinates[0], location.coordinates[1]], // Seeker's coordinates
                        radius / 6378.1 // Radius in radians
                    ]
                }
            },
            expirationTime: { $gte: new Date() }, // Current date
            status: 'pending'
        }).populate('seeker', 'userName email contactNumber');

        res.status(200).json(activeRequests);
    } catch (error) {
        console.error('Error fetching active requests:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// Accept a service request
exports.acceptRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        console.log(requestId)
        const user = await User.findById(req.user.id).select('status')
        // Ensure the user is a provider
        if (req.user.role !== 'provider') {
            return res.status(403).json({ message: 'Only providers can accept requests' });
        }

        if (user.status === 'in-progress') {
        return res.status(400).json({ message: 'You have an active request in progress. Please complete it before accepting a new request.' });
        }
      
        // Find and update the request
        const request = await ServiceRequest.findById(requestId);
        if (!request) return res.status(404).json({ message: 'Service request not found' });

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request is no longer active' });
        }

        request.status = 'in-progress';
        request.provider = req.user.id;
        request.generatedPin = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit PIN
         
        user.status = 'in-progress'; // Set status to in-progress
        await user.save();

        await request.save();
        res.status(200).json({ message: 'Request accepted', request });
    } catch (error) {
        console.error('Error accepting request:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update request status to 'completed'
exports.completeRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const { pin } = req.body;

        // Find the service request
        const request = await ServiceRequest.findById(requestId);
        if (!request) return res.status(404).json({ message: 'Service request not found' });

        // Validate PIN
        if (request.generatedPin !== pin) {
            return res.status(400).json({ message: 'Invalid PIN' });
        }

        request.status = 'completed';
        await request.save();
        // Update provider's status
        const user = await User.findById(req.user.id);
        user.status = 'online'; // or 'active' based on your logic
        await user.save();

        res.status(200).json({ message: 'Request completed successfully', request });
    } catch (error) {
        console.error('Error completing request:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getRequestHistory = async (req, res) => {
    try {
        const userId = req.user.id; // Authenticated user's ID
        const userRole = req.user.role; // 'seeker' or 'provider'

        let history = [];

        if (userRole === 'seeker') {
            // Get all requests where the user is the seeker
            history = await ServiceRequest.find({ seeker: userId })
                .populate('provider', 'userName contactNumber') // Populate provider's details
                .select('category description contactNumber location status history createdAt expirationTime generatedPin') // Add generatedPin to selected fields
                .exec();

            const formattedHistory = history.map(request => ({
                _id: request._id,
                category: request.category,
                description: request.description,
                contactNumber: request.contactNumber,
                location: request.location.coordinates,
                status: request.status,
                provider: request.provider ? {
                    name: request.provider.userName,
                    contactNumber: request.provider.contactNumber
                } : null,
                history: request.history ? request.history.map(item => ({
                    status: item.status,
                    provider: item.provider, // ID of provider who changed the status
                    timestamp: item.timestamp
                })) : [],
                createdAt: request.createdAt,
                expirationTime: request.expirationTime,
                // Only include PIN for in-progress requests
                generatedPin: request.status === 'in-progress' ? request.generatedPin : undefined
            }));

            return res.status(200).json({
                role: 'seeker',
                history: formattedHistory
            });

        } else if (userRole === 'provider') {
            // Get all requests where the user is the provider
            history = await ServiceRequest.find({ 'history.provider': userId })
                .populate('seeker', 'userName contactNumber') // Populate seeker's details
                .select('category description contactNumber location status history createdAt expirationTime') // Select relevant fields
                .exec();

            const formattedHistory = history.map(request => ({
                _id: request._id,
                category: request.category,
                description: request.description,
                contactNumber: request.contactNumber,
                location: request.location.coordinates,
                status: request.status,
                seeker: request.seeker ? {
                    name: request.seeker.userName,
                    contactNumber: request.seeker.contactNumber
                } : null,
                history: request.history.filter(item => String(item.provider) === String(userId)).map(item => ({
                    status: item.status,
                    timestamp: item.timestamp
                })),
                createdAt: request.createdAt,
                expirationTime: request.expirationTime
            }));

            return res.status(200).json({
                role: 'provider',
                history: formattedHistory
            });
        } else {
            return res.status(403).json({ message: 'Invalid user role' });
        }
    } catch (error) {
        console.error('Error fetching request history:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get verification PIN for a specific request
exports.getRequestPin = async (req, res) => {
    try {
        const requestId = req.params.id;
        const userId = req.user.id;
        
        const request = await ServiceRequest.findById(requestId);
        
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        // Only allow seeker to fetch PIN for their own request
        if (request.seeker.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this request' });
        }
        
        // Only return PIN if request is in-progress
        if (request.status !== 'in-progress') {
            return res.status(400).json({ message: 'PIN is only available for in-progress requests' });
        }
        
        res.json({
            requestId: request._id,
            generatedPin: request.generatedPin
        });
        
    } catch (error) {
        console.error('Error fetching request PIN:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Cancel a service request (only by the seeker who created it)
exports.cancelRequest = async (req, res) => {
    try {
        console.log(`Request ID: ${req.params.id}`); // Log the request ID
        console.log(`User Info: ${JSON.stringify(req.user)}`); // Log the user info

        const requestId = req.params.id;
        console.log(`Request ID: ${requestId}`); // Log the request ID

        const user = await User.findById(req.user.id).select('status role');
        console.log(`User Info: ${JSON.stringify(user)}`); // Log the user info

        // Ensure the user is a seeker
        if (req.user.role !== 'seeker') {
            console.log('User is not a seeker'); // Log role mismatch
            return res.status(403).json({ message: 'Only seekers can cancel requests' });
        }

        // Find the request
        const request = await ServiceRequest.findById(requestId);
        console.log(`Service Request: ${JSON.stringify(request)}`); // Log the service request

        if (!request) {
            console.log('Service request not found'); // Log missing request
            return res.status(404).json({ message: 'Service request not found' });
        }

        if (request.status !== 'pending') {
            console.log(`Request status is not pending: ${request.status}`); // Log invalid status
            return res.status(400).json({ message: 'Request is in progress and cannot be cancelled.' });
        }

        // Update request status to cancelled
        request.status = 'cancelled';
        console.log('Request status updated to cancelled'); // Log status update

        // Save the updated request
        await request.save();
        console.log('Request saved successfully'); // Log successful save

        res.status(200).json({ message: 'Request cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling request:', error); // Log the error
        res.status(500).json({ message: 'Server error' });
    }
};

