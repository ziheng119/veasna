// routes/session.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { comparePassword } = require('../config/db');
const { normalizeRole } = require('../utils/permissions');
const { hostClock } = require('../utils/hostClock');

let ensurePasswordColumnPromise = null;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
}

async function ensurePasswordColumn() {
  if (!ensurePasswordColumnPromise) {
    ensurePasswordColumnPromise = db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `).catch((err) => {
      ensurePasswordColumnPromise = null;
      throw err;
    });
  }
  return ensurePasswordColumnPromise;
}

function normalizeCredentials(username, password) {
  if (typeof username !== 'string' || username.trim().length < 3) {
    return { error: 'username (>=3 chars) is required' };
  }

  if (typeof password !== 'string' || !password) {
    return { error: 'Password is required' };
  }

  return {
    username: username.trim(),
    password,
  };
}

// A sign-in lasts 7 days, renewed while the device is in use: when less than 3 days are left,
// GET /auth/me (called on every page change) returns a new token. A device in daily use never
// reaches expiry in the middle of a form; one left unused for a week signs in again.
const TOKEN_LIFETIME_SECONDS = 7 * 24 * 3600;
const RENEW_WITHIN_SECONDS = 3 * 24 * 3600;

function signUserToken(user) {
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user' },
    getJwtSecret(),
    { expiresIn: TOKEN_LIFETIME_SECONDS }
  );

  return token;
}

// A new token when this one (its `exp`, in seconds) is close to expiry; otherwise undefined.
function renewedToken(user, now = Date.now()) {
  if (typeof user.exp !== 'number' || user.exp - now / 1000 > RENEW_WITHIN_SECONDS) return undefined;
  return signUserToken(user);
}

const { authenticateToken } = require('./auth');

router.get('/me', authenticateToken, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    id: req.user.id, username: req.user.username, role: req.user.role, screening_date: req.user.screening_date ?? null,
    ...hostClock(),
    // The role and name here are the current ones from the database (middleware/authorizeApi.js).
    token: renewedToken(req.user),
  });
});

// Fixed deployment accounts: registration is deliberately unavailable, including to admins.
router.post('/register', authenticateToken, (_req, res) => res.status(403).json({ message: 'Account creation is disabled.' }));

router.post('/login', async (req, res) => {
  const parsed = normalizeCredentials(req.body.username, req.body.password);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  const { username, password } = parsed;

  try {

    const userQuery = `
      SELECT id, username, password_hash, role, is_active,
        TO_CHAR(screening_date, 'YYYY-MM-DD') AS screening_date
      FROM users
      WHERE LOWER(username) = LOWER($1)
    `;
    const { rows } = await db.query(userQuery, [username]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = { ...rows[0], role: normalizeRole(rows[0].role) };
    if (!user.is_active) {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        message: 'This account has no password yet. Please create a new account or ask admin to reset password.',
      });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = signUserToken(user);

    res.json({ token, user: { id: user.id, username: user.username, role: user.role, screening_date: user.screening_date }, ...hostClock() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
module.exports.ensurePasswordColumn = ensurePasswordColumn;
module.exports.renewedToken = renewedToken;
