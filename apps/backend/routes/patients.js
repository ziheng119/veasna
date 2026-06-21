// routes/patients.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');

// (location id) -> patients[]
router.get('/', authenticateToken, requireRole(['any']), async (req, res) => {
  const { location_id } = req.query;

  if (!location_id) {
    return res.status(400).json({ error: 'location_id is required' });
  }

  try {
    const queryText = `
      SELECT p.*, l.name AS location_name
      FROM patients p
      JOIN locations l ON l.id = p.location_id
      WHERE p.location_id = $1
      ORDER BY p.english_name ASC
    `;
    const result = await db.query(queryText, [location_id]);
    res.status(200).json(result.rows)

  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// (patient id) -> patient details
router.get('/:id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Patient id is required' });
  }

  try {
    const queryText = `
      SELECT p.*
      FROM patients p
      WHERE p.id = $1
    `;

    const result = await db.query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('Error fetching patient:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/search', authenticateToken, requireRole(['any']), async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query "q" is required' });
  }

  try {
    const searchTerm = `%${q}%`;
    const queryText = `
      SELECT * FROM patients
      WHERE english_name ILIKE $1 OR khmer_name ILIKE $1
      LIMIT 10
    `;
    const result = await db.query(queryText, [searchTerm]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error searching patients:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

module.exports = router;
