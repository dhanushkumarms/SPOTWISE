const mongoose = require('mongoose');

// Provider location schema with live tracking
const providerLocationSchema = new mongoose.Schema({
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the provider (User)
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' }, // GeoJSON format
        coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    updatedAt: { type: Date, default: Date.now } // Timestamp for location updates
}, { timestamps: true });

providerLocationSchema.index({ location: '2dsphere' }); // 2dsphere index for geospatial queries

// Seeker location schema (static, chosen once)
const seekerLocationSchema = new mongoose.Schema({
    seeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the seeker (User)
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' }, // GeoJSON format
        coordinates: { type: [Number], required: true } // [longitude, latitude] chosen once
    }
});

const ProviderLocation = mongoose.model('ProviderLocation', providerLocationSchema);
const SeekerLocation = mongoose.model('SeekerLocation', seekerLocationSchema);

module.exports = { ProviderLocation, SeekerLocation };
