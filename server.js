// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const goalRoutes = require('./routes/goals');

/**
 * Dynamic CORS configuration
 * Allows your production URL and any Vercel preview URL set in PREVIEW_URL.
 */
const allowedOrigins = [
  process.env.FRONTEND_URL,                            // e.g. https://resource-room-frontend.vercel.app
  process.env.PREVIEW_URL && `https://${process.env.PREVIEW_URL}`
].filter(Boolean);

app.use(cors({
  origin: (incomingOrigin, callback) => {
    // allow requests with no origin (e.g. server-to-server, curl)
    if (!incomingOrigin) return callback(null, true);
    if (allowedOrigins.includes(incomingOrigin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: origin ${incomingOrigin} not allowed`));
  },
  credentials: true
}));

// Built-in JSON body parser
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/resource-room'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Connect to MongoDB Atlas or local
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/resource-room', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mount routes under /api
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/goals', goalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Resource Room API is running' });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
