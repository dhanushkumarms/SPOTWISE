require('dotenv').config(); // Load environment variables first
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const eventRoutes = require('./routes/eventRoutes'); // Add this line

const app = express();
app.use(express.json());

const allowedOrigins = [
    'http://127.0.0.1:5501', // Local frontend
    'https://spotwise.vercel.app', // Deployed frontend
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies if needed
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Serve static files from the 'frontend/public' folder
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Use routes
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', eventRoutes); // Add this line for the events route

// Serve the index.html file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'login.html'));
});

// Start the server
const PORT = process.env.PORT || 3000; // Use dynamic port for Vercel
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
