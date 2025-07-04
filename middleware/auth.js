const Teacher = require('../models/Teacher');

// Middleware to check if teacher is authenticated
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    // Verify teacher still exists and is active
    const teacher = await Teacher.findById(req.session.teacherId);
    if (!teacher || !teacher.isActive) {
      req.session.destroy();
      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'Please log in again'
      });
    }

    req.teacher = teacher;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware to check if teacher is already logged in
const requireGuest = (req, res, next) => {
  if (req.session.teacherId) {
    return res.status(400).json({ 
      error: 'Already logged in',
      message: 'You are already logged in'
    });
  }
  next();
};

// Middleware to validate registration code
const validateRegistrationCode = (req, res, next) => {
  const { registrationCode } = req.body;
  
  if (!registrationCode || registrationCode !== process.env.TEACHER_REGISTRATION_CODE) {
    return res.status(400).json({ 
      error: 'Invalid registration code',
      message: 'Please contact your administrator for the correct registration code'
    });
  }
  
  next();
};

module.exports = {
  requireAuth,
  requireGuest,
  validateRegistrationCode
};