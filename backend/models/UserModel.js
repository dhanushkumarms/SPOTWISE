const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please enter a valid email address'
        ]
    },
    contactNumber: {
        type: String,
        match: [
            /^[0-9]{10}$/,
            'Please enter a valid 10-digit contact number'
        ]
    },
    role: {
        type: String,
        enum: ['seeker', 'provider'],
        required: true
    },
    address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        postalCode: { type: String },
        country: { type: String }
    },
    skills: {
        type: [String],
        required: function() { return this.role === 'provider'; }
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: function() { return this.role === 'provider'; } } // [longitude, latitude] for seeker's location
    },
    status: {
        type: String,
        enum: ['offline', 'online', 'active', 'in-progress'],
        default: 'offline', // Initial status for new providers
    },
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Schema method to check password validity
userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
