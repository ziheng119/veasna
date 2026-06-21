// routes/locations.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../routes/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name 
      FROM locations 
      WHERE is_active = TRUE 
      ORDER BY name
    `);

    res.json({ locations: result.rows });
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    const result = await db.query(
      `INSERT INTO locations (name, is_active, created_at)
      VALUES ($1, $2, $3)
      RETURNING id, name, is_active, created_at`,
      [name, true, new Date()]
    );

    res.status(201).json({ 
      message: 'Location created successfully', 
      location: result.rows[0] 
    });
  } catch (err) {
    console.error('Error creating location:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const checkResult = await db.query(
      `SELECT id FROM locations WHERE id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Location not found' });
    }

    const result = await db.query(
      `UPDATE locations SET is_active = false
      WHERE id = $1
      RETURNING id, name, is_active`,
      [id]
    );

    res.json({
      message: 'Location deleted successfully',
      location: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting location:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
