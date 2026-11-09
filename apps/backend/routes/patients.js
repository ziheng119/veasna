// routes/patients.js

const express = require('express');
const router = express.Router();
const { integerParams, toPositiveInt, isIsoDate } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['id']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { currentVisitDate } = require('../utils/queueNumber');
const { patientOnDaySql } = require('../utils/dayScope');

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
    // $2: today's clinic date, for where the patient is waiting now. $3: a screening-day account's
    // date (only patients queued that day), else NULL.
    const values = [location_id, currentVisitDate(), req.user.scope_date ?? null];
    let visitFilter = '';

    if (visit_date) {
      values.push(visit_date);
      visitFilter = `
        AND EXISTS (
          SELECT 1
          FROM visits v
          WHERE v.patient_id = p.id
            AND v.location_id = p.location_id
            AND v.visit_date = $4::date
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
        AND ${patientOnDaySql('p.id', '$3')}
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
      SELECT * FROM patients p
      WHERE (english_name ILIKE $1 OR khmer_name ILIKE $1)
        AND ${patientOnDaySql('p.id', '$2')}
      LIMIT 10
    `;
    const result = await db.query(queryText, [searchTerm, req.user.scope_date ?? null]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error searching patients:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/patients/lookup?location_id=...&q=... - returning patients at a location whose English
// or Khmer name contains q (at least 3 letters), for linking a registration to an earlier record.
// Open to screening-day accounts for every patient, since a villager who came on an earlier trip must
// be found to be queued, so it returns only what identifies them, never clinical data.
const LOOKUP_MIN_LENGTH = 3;
router.get('/lookup', authenticateToken, requireRole(['any']), async (req, res) => {
  const locationId = toPositiveInt(req.query.location_id);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!locationId) return res.status(400).json({ error: 'location_id must be a positive integer' });
  if (q.length < LOOKUP_MIN_LENGTH) return res.status(200).json([]);
  const { rows } = await db.query(
    `SELECT id, face_id, location_id, english_name, khmer_name,
            TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth, sex, address, phone_number, family
     FROM patients
     WHERE location_id = $1 AND (english_name ILIKE $2 OR khmer_name ILIKE $2)
     ORDER BY english_name ASC LIMIT 10`,
    [locationId, `%${q.replace(/[%_\\]/g, '\\$&')}%`]
  );
  res.status(200).json(rows);
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
