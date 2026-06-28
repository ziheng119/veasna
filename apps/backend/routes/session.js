// routes/session.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { hashPassword, comparePassword } = require('../config/db');

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
    `);
  }
  return ensurePasswordColumnPromise;
}

function normalizeCredentials(username, password) {
  if (!username || username.trim().length < 3) {
    return { error: 'username (>=3 chars) is required' };
  }

  if (!password || password.length < 8) {
    return { error: 'password (>=8 chars) is required' };
  }

  return {
    username: username.trim(),
    password,
  };
}

function signUserToken(user) {
  const token = jwt.sign(
    { id: user.id, username: user.username },
    getJwtSecret(),
    { expiresIn: '30d' }
  );

  return token;
}

router.post('/register', async (req, res) => {
  const parsed = normalizeCredentials(req.body.username, req.body.password);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  const { username, password } = parsed;

  try {
    await ensurePasswordColumn();
    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = await hashPassword(password);
    const insertQuery = `
      INSERT INTO users (username, password_hash, is_active)
      VALUES ($1, $2, TRUE)
      RETURNING id, username;
    `;

    const { rows } = await db.query(insertQuery, [username, passwordHash]);
    const user = rows[0];
    const token = signUserToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const parsed = normalizeCredentials(req.body.username, req.body.password);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  const { username, password } = parsed;

  try {
    await ensurePasswordColumn();
    const userQuery = `
      SELECT id, username, password_hash, is_active
      FROM users
      WHERE LOWER(username) = LOWER($1)
    `;
    const { rows } = await db.query(userQuery, [username]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];
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

    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
