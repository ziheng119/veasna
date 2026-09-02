// routes/api.js

const express = require('express');
const router = express.Router();

const sessionRoutes = require('./session');
const patientRoutes = require('./patient');
const patientsRoutes = require('./patients');
const locationRoutes = require('./locations');
const registrationRoutes = require('./registration');
const queueRoutes = require('./queue');
const visitRoutes = require('./visits');
const pharmacyRoutes = require('./pharmacy');
const triageRoutes = require('./triage');

router.use('/auth', sessionRoutes);
router.use('/locations', locationRoutes);
router.use('/registration', registrationRoutes);
router.use('/queue', queueRoutes);
router.use('/visits', visitRoutes);
router.use('/pharmacy', pharmacyRoutes);
router.use('/triage', triageRoutes);
router.use('/patient', patientRoutes);

const { body } = require('express-validator');

const db = require('../config/db');
const { authenticateToken, requireRole, validateRequest } = require('./auth');

// --- User Management (any authenticated user) ---

// GET all users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT username
       FROM users
       WHERE is_active = TRUE
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST create a new user
router.post(
  '/users',
  authenticateToken,
  requireRole(['any']),
  [
    body('username')
      .isLength({ min: 2 })
      .withMessage('Username must be at least 2 characters'),
  ],
  validateRequest,
  async (req, res) => {
    const { username } = req.body;
    const normalizedUsername = username.trim();

    try {
      // 1️⃣ Check if user already exists
      const checkQuery = 'SELECT id, username, is_active FROM users WHERE LOWER(username) = LOWER($1)';
      const { rows: existingUsers } = await db.query(checkQuery, [normalizedUsername]);

      if (existingUsers.length === 0) {
        // 2️⃣ User does not exist → create
        const insertQuery = `
          INSERT INTO users (username, is_active)
          VALUES ($1, TRUE)
          RETURNING id, username, is_active, created_at;
        `;
        const { rows } = await db.query(insertQuery, [normalizedUsername]);
        return res.status(201).json({
          message: 'User successfully created',
          user: rows[0],
        });
      }

      // 3️⃣ User exists
      const existingUser = existingUsers[0];

      if (!existingUser.is_active) {
        // 4️⃣ User exists but inactive → activate
        const updateQuery = `
          UPDATE users
          SET is_active = TRUE
          WHERE id = $1
          RETURNING id, username, is_active, created_at;
        `;
        const { rows } = await db.query(updateQuery, [existingUser.id]);
        return res.status(200).json({
          message: 'User successfully activated',
          user: rows[0],
        });
      }

      // 5️⃣ User exists and already active → just return
      return res.status(200).json({
        message: 'User already active',
        user: existingUser,
      });

    } catch (error) {
      console.error('Create/Activate User Error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PATCH /users/deactivate
router.patch(
  '/users/deactivate',
  authenticateToken,
  requireRole(['any']),
  [
    body('username')
      .isLength({ min: 2 })
      .withMessage('Username must be at least 2 characters'),
  ],
  validateRequest,
  async (req, res) => {
    const { username } = req.body;
    const values = [username]; // Parameters array

    // Define SQL queries as constants
    const SELECT_USER = `
      SELECT id, username, is_active
      FROM users
      WHERE LOWER(username) = LOWER($1)
    `;

    const DEACTIVATE_USER = `
      UPDATE users
      SET is_active = FALSE
      WHERE LOWER(username) = LOWER($1)
      RETURNING id, username, is_active, created_at
    `;

    try {
      // 1️⃣ Check if user exists
      const { rows: users } = await db.query(SELECT_USER, values);

      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = users[0];

      if (!user.is_active) {
        // 2️⃣ User already inactive
        return res.status(200).json({
          message: 'User already inactive',
          user,
        });
      }

      // 3️⃣ Deactivate user
      const { rows } = await db.query(DEACTIVATE_USER, values);

      return res.status(200).json({
        message: 'User successfully deactivated',
        user: rows[0],
      });
    } catch (error) {
      console.error('Deactivate User Error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.use('/patients', patientsRoutes);

module.exports = router;
