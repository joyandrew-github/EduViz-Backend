const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('./middleware/passport');
const mongoose = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');
const modelRoutes = require('./routes/modelRoutes');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const { router: paymentRoutes, initializeRazorpay } = require('./routes/paymentRoutes');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Initialize the Razorpay instance in the payment routes
initializeRazorpay(razorpayInstance);

// CORS setup
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'withCredentials'], // Explicitly allow withCredentials
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session and Passport middleware for all routes
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
  
});

// Apply session and passport middleware to all routes
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded images statically
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/messages', messageRoutes);
app.use(chatRoutes);
app.use(modelRoutes);
app.use(authRoutes);
app.use(paymentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;