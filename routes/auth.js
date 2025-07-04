const express = require('express');
const Teacher = require('../models/Teacher');
const Goal = require('../models/Goals');
const { requireAuth, requireGuest, validateRegistrationCode } = require('../middleware/auth');

const router = express.Router();

// Register new teacher
router.post('/register', requireGuest, validateRegistrationCode, async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, school } = req.body;

    // Validation
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please fill in all required fields'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({
      $or: [{ email }, { username }]
    });

    if (existingTeacher) {
      return res.status(400).json({
        error: 'Teacher already exists',
        message: 'A teacher with this email or username already exists'
      });
    }

    // Create new teacher
    const teacher = new Teacher({
      username,
      email,
      password,
      firstName,
      lastName,
      school
    });

    await teacher.save();

    // Create default goals for the new teacher
    await Goal.createDefaultGoals(teacher._id);

    // Log in the teacher
    req.session.teacherId = teacher._id;

    res.status(201).json({
      message: 'Registration successful',
      teacher: teacher.toJSON()
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Duplicate field',
        message: 'Username or email already exists'
      });
    }

    res.status(500).json({
      error: 'Registration failed',
      message: 'Please try again later'
    });
  }
});

// Login teacher
router.post('/login', requireGuest, async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Please enter both username/email and password'
      });
    }

    // Find teacher by username or email
    const teacher = await Teacher.findOne({
      $or: [
        { username: login },
        { email: login.toLowerCase() }
      ],
      isActive: true
    });

    if (!teacher) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username/email or password is incorrect'
      });
    }

    // Check password
    const isMatch = await teacher.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username/email or password is incorrect'
      });
    }

    // Log in the teacher
    req.session.teacherId = teacher._id;

    res.json({
      message: 'Login successful',
      teacher: teacher.toJSON()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Please try again later'
    });
  }
});

// Logout teacher
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        error: 'Logout failed',
        message: 'Please try again'
      });
    }

    res.json({ message: 'Logout successful' });
  });
});

// Get current teacher info
router.get('/me', requireAuth, (req, res) => {
  res.json({
    teacher: req.teacher.toJSON()
  });
});

// Check if teacher is logged in
router.get('/check', (req, res) => {
  if (req.session.teacherId) {
    res.json({ 
      isAuthenticated: true,
      teacherId: req.session.teacherId
    });
  } else {
    res.json({ 
      isAuthenticated: false 
    });
  }
});

module.exports = router;