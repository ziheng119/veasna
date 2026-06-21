// routes/session.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ message: 'username (>=3 chars) is required' });
  }

  try {
    // Upsert user by username (no password, no role)
    const upsert = `
      INSERT INTO users (username)
      VALUES ($1)
      ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
      RETURNING id, username;
    `;
    const { rows } = await db.query(upsert, [username.trim()]);
    const user = rows[0];

    // Sign a token with just id and username
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user });
  } catch (err) {
    console.error('Passwordless login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
