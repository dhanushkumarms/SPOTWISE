const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const ServiceRequest = require('../models/ServiceRequestModel');

// SSE endpoint for real-time updates
router.get('/events', async (req, res) => {
    // Extract and verify token
    const token = req.query.token;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx

        // Send initial connection message
        res.write('event: connected\n');
        res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);
        
        // Handle client disconnect
        const clientId = Date.now();
        let changeStream = null;
        
        req.on('close', () => {
            console.log(`Client ${clientId} disconnected`);
            if (changeStream) {
                changeStream.close();
            }
        });

        // Keep connection alive with heartbeat
        const heartbeatInterval = setInterval(() => {
            if (res.writableEnded) {
                clearInterval(heartbeatInterval);
                return;
            }
            
            res.write('event: heartbeat\n');
            res.write(`data: ${Date.now()}\n\n`);
        }, 30000); // Send heartbeat every 30 seconds

        // Create MongoDB change stream
        changeStream = ServiceRequest.watch();
        
        changeStream.on('change', async (change) => {
            if (res.writableEnded) return;
            
            // Only send updates for document updates
            if (change.operationType === 'update') {
                try {
                    // Get the updated document
                    const request = await ServiceRequest.findById(change.documentKey._id);
                    
                    // Only send if request exists and is relevant to this user
                    if (request && (
                        request.seeker.toString() === userId || 
                        (request.provider && request.provider.toString() === userId)
                    )) {
                        // Send event to client
                        res.write('event: requestUpdated\n');
                        res.write(`data: ${JSON.stringify(request)}\n\n`);
                    }
                } catch (err) {
                    console.error('Error fetching updated request:', err);
                }
            }
        });

    } catch (err) {
        console.error('SSE error:', err);
        res.status(401).json({ message: 'Invalid token' });
    }
});

module.exports = router;
