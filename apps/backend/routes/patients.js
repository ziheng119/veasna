// routes/patients.js

const express = require('express');
const router = express.Router();
const { integerParams, toPositiveInt, isIsoDate } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['id']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { currentVisitDate } = require('../utils/queueNumber');

// (location id) -> patients[]
router.get('/', authenticateToken, requireRole(['any']), async (req, res) => {
  const location_id = toPositiveInt(req.query.location_id);
  const { visit_date } = req.query;

  if (!location_id) {
    return res.status(400).json({ error: 'location_id must be a positive integer' });
  }

  if (visit_date && !isIsoDate(visit_date)) {
    return res.status(400).json({ error: 'visit_date must be a valid YYYY-MM-DD date' });
  }

  try {
    // $2: today's clinic date, for where the patient is waiting now.
    const values = [location_id, currentVisitDate()];
    let visitFilter = '';

    if (visit_date) {
      values.push(visit_date);
      visitFilter = `
        AND EXISTS (
          SELECT 1
          FROM visits v
          WHERE v.patient_id = p.id
            AND v.location_id = p.location_id
            AND v.visit_date = $3::date
        )
      `;
    }

    const queryText = `
      SELECT p.*, l.name AS location_name,
        -- Most recent day the patient was seen at a screening (YYYY-MM-DD), or null.
        (
          SELECT TO_CHAR(MAX(lv.visit_date), 'YYYY-MM-DD')
          FROM visits lv
          WHERE lv.patient_id = p.id
        ) AS last_visit_date,
        -- In today's queue here: the open visit and the station it waits at (null when not queued).
        q.visit_id AS queue_visit_id, q.station AS current_station
      FROM patients p
      JOIN locations l ON l.id = p.location_id
      LEFT JOIN LATERAL (
        SELECT v.id AS visit_id, (
          SELECT s.station FROM visit_stations s
          WHERE s.visit_id = v.id AND s.completed_at IS NULL
          ORDER BY s.position LIMIT 1
        ) AS station
        FROM visits v
        WHERE v.patient_id = p.id AND v.location_id = p.location_id
          AND v.visit_date = $2::date AND v.completed_at IS NULL
        ORDER BY v.id DESC LIMIT 1
      ) q ON TRUE
      WHERE p.location_id = $1
      ${visitFilter}
      ORDER BY p.english_name ASC
    `;
    const result = await db.query(queryText, values);
    res.status(200).json(result.rows)

  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.get('/search', authenticateToken, requireRole(['any']), async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query "q" is required' });
  }

  try {
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    const searchTerm = `%${escaped}%`;
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
});

// (patient id) -> patient details
router.get('/:id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id } = req.params;

  if (!id || !Number.isInteger(Number(id)) || Number(id) < 1) {
    return res.status(400).json({ error: 'Patient id must be a positive integer' });
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

module.exports = router;
