// routes/auth.js

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user has required role
const requireRole = (_roles) => (_req, _res, next) => next();

// Middleware to validate request data
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  validateRequest
}; 