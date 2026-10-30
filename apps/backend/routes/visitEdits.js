// routes/visitEdits.js
// Admin-only corrections to a saved visit, used by the Patient Details page.
//
// Station notes (triage, SEVA, physiotherapy, consultation, referral) are edited through their
// existing upsert endpoints, which already let admins overwrite a saved row. This router covers
// the parts of a visit that have no such endpoint:
//   PUT /api/visits/:visitId         visit details: queue number, visit date, location
//   PUT /api/visits/:visitId/vitals  vitals and HEF captured at registration
//   PUT /api/visits/:visitId/tb      TB screening record (red flags, notes, flag status)
// Every write records the admin in last_updated_by and bumps last_updated_at for sync/audit.
const express = require('express');
const router = express.Router();
const { integerParams } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['visitId']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');
const { lockQueue, normalizeQueueNo, isValidQueueNo, QUEUE_NO_ERROR } = require('../utils/queueNumber');
const { textOrEmpty } = require('../utils/partialFields');
const { normalizeVitals } = require('../utils/vitals');
const { TB_STATUSES, normalizeRedFlags } = require('../utils/tb');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Applied per route: a router-level guard would also block GET /api/visits/* for users,
// because this router shares the /visits mount point with routes/visits.js.
const adminOnly = [authenticateToken, requireRole(['admin'])];

function parsePositiveInt(value) {
  const num = Number(value);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

function isValidDate(value) {
  return typeof value === 'string' && DATE_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

// Runs `work(client)` in a transaction. `work` returns { status, body }; anything other than
// 2xx rolls back so a rejected edit never leaves a partial write.
async function inTransaction(res, label, work) {
  let client;
  try {
    client = await db.pool.connect();
  } catch (err) {
    console.error('Failed to acquire database connection:', err);
    return res.status(500).json({ error: 'Database connection unavailable' });
  }
  try {
    await client.query('BEGIN');
    const { status, body } = await work(client);
    await client.query(status < 300 ? 'COMMIT' : 'ROLLBACK');
    res.status(status).json(body);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error(`Error updating ${label}:`, err);
    res.status(500).json({ error: `Unable to update ${label}` });
  } finally {
    client.release();
  }
}

// PUT /api/visits/:visitId
// Body: { queue_no?, visit_date? (YYYY-MM-DD), location_id? }. Omitted fields keep their value.
router.put('/:visitId', ...adminOnly, async (req, res) => {
  const visitId = parsePositiveInt(req.params.visitId);
  if (!visitId) return res.status(400).json({ error: 'Visit ID must be a positive integer' });

  const { queue_no, visit_date, location_id } = req.body;
  const queueNo = queue_no === undefined ? undefined : normalizeQueueNo(queue_no);
  if (queueNo !== undefined && !isValidQueueNo(queueNo)) {
    return res.status(400).json({ error: QUEUE_NO_ERROR });
  }
  if (visit_date !== undefined && !isValidDate(visit_date)) {
    return res.status(400).json({ error: 'visit_date must be a valid date (YYYY-MM-DD)' });
  }
  const locationId = location_id === undefined ? undefined : parsePositiveInt(location_id);
  if (locationId === null) return res.status(400).json({ error: 'location_id must be a positive integer' });
  if (queueNo === undefined && visit_date === undefined && locationId === undefined) {
    return res.status(400).json({ error: 'Provide at least one of queue_no, visit_date or location_id' });
  }

  await inTransaction(res, 'visit details', async (client) => {
    const current = await client.query(
      `SELECT id, queue_no, TO_CHAR(visit_date, 'YYYY-MM-DD') AS visit_date, location_id FROM visits WHERE id = $1 FOR UPDATE`,
      [visitId]
    );
    if (!current.rows.length) return { status: 404, body: { error: 'Visit not found' } };

    const next = {
      queue_no: queueNo ?? current.rows[0].queue_no,
      visit_date: visit_date ?? current.rows[0].visit_date,
      location_id: locationId ?? current.rows[0].location_id,
    };
    if (next.location_id) {
      const location = await client.query('SELECT 1 FROM locations WHERE id = $1', [next.location_id]);
      if (!location.rows.length) return { status: 400, body: { error: 'Location not found' } };
      // Same lock as registration, so a new patient cannot take this number concurrently.
      await lockQueue(client, next.location_id);
    }
    const duplicate = await client.query(
      `SELECT 1 FROM visits
       WHERE id <> $1 AND location_id IS NOT DISTINCT FROM $2 AND visit_date = $3::date AND UPPER(queue_no) = $4`,
      [visitId, next.location_id, next.visit_date, next.queue_no]
    );
    if (duplicate.rows.length) {
      return { status: 409, body: { error: `Queue number ${next.queue_no} is already used at this location on ${next.visit_date}` } };
    }

    const { rows } = await client.query(
      `UPDATE visits
       SET queue_no = $2, visit_date = $3::date, location_id = $4, last_updated_by = $5, last_updated_at = NOW()
       WHERE id = $1
       RETURNING id AS visit_id, patient_id, queue_no, TO_CHAR(visit_date, 'YYYY-MM-DD') AS visit_date,
         location_id, last_updated_at, last_updated_by`,
      [visitId, next.queue_no, next.visit_date, next.location_id, req.user.id]
    );
    return { status: 200, body: rows[0] };
  });
});

// PUT /api/visits/:visitId/vitals
// Body: { vitals?: { height, weight, bmi, below_3rd_percentile, bp_systolic, bp_diastolic,
//         temperature, notes }, hef?: { know_of_hef, has_hef, notes } }
// Either section may be sent alone. A missing row is created, so admins can backfill a visit.
router.put('/:visitId/vitals', ...adminOnly, async (req, res) => {
  const visitId = parsePositiveInt(req.params.visitId);
  if (!visitId) return res.status(400).json({ error: 'Visit ID must be a positive integer' });

  const { vitals, hef } = req.body;
  if (vitals == null && hef == null) {
    return res.status(400).json({ error: 'Provide vitals, hef, or both' });
  }
  const normalizedVitals = vitals == null ? null : normalizeVitals(vitals);
  if (normalizedVitals?.error) return res.status(400).json({ error: normalizedVitals.error });
  if (hef != null && (typeof hef.know_of_hef !== 'boolean' || typeof hef.has_hef !== 'boolean')) {
    return res.status(400).json({ error: 'hef.know_of_hef and hef.has_hef must be true or false' });
  }

  await inTransaction(res, 'vitals', async (client) => {
    const visit = await client.query('SELECT id FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
    if (!visit.rows.length) return { status: 404, body: { error: 'Visit not found' } };

    const body = {};
    if (normalizedVitals) {
      const v = normalizedVitals.values;
      const { rows } = await client.query(
        `INSERT INTO vitals (visit_id, height, weight, bmi, below_3rd_percentile, bp_systolic, bp_diastolic, temperature, notes, last_updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (visit_id) DO UPDATE SET
           height = EXCLUDED.height, weight = EXCLUDED.weight, bmi = EXCLUDED.bmi,
           below_3rd_percentile = EXCLUDED.below_3rd_percentile,
           bp_systolic = EXCLUDED.bp_systolic, bp_diastolic = EXCLUDED.bp_diastolic,
           temperature = EXCLUDED.temperature, notes = EXCLUDED.notes,
           last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()
         RETURNING *`,
        [visitId, v.height, v.weight, v.bmi, v.below_3rd_percentile, v.bp_systolic, v.bp_diastolic,
          v.temperature, textOrEmpty(v.notes), req.user.id]
      );
      body.vitals = rows[0];
    }
    if (hef != null) {
      const { rows } = await client.query(
        `INSERT INTO hef (visit_id, know_of_hef, has_hef, notes, last_updated_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (visit_id) DO UPDATE SET
           know_of_hef = EXCLUDED.know_of_hef, has_hef = EXCLUDED.has_hef, notes = EXCLUDED.notes,
           last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()
         RETURNING *`,
        [visitId, hef.know_of_hef, hef.has_hef, textOrEmpty(hef.notes), req.user.id]
      );
      body.hef = rows[0];
    }
    return { status: 200, body };
  });
});

// PUT /api/visits/:visitId/tb
// Body: { red_flags?: string[], flag_notes?, doctor_notes?, status?: 'suspected' | 'cleared' | 'tb_likely' }.
// TB is a flag on the visit ('suspected' or 'tb_likely' = flagged, 'cleared' = not flagged), so it
// can be corrected at any time without touching the station route.
router.put('/:visitId/tb', ...adminOnly, async (req, res) => {
  const visitId = parsePositiveInt(req.params.visitId);
  if (!visitId) return res.status(400).json({ error: 'Visit ID must be a positive integer' });

  const { flag_notes, doctor_notes, status } = req.body;
  const redFlags = req.body.red_flags === undefined ? undefined : normalizeRedFlags(req.body.red_flags);
  if (redFlags === null) return res.status(400).json({ error: 'red_flags must be a list of text' });
  if (status !== undefined && !TB_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${TB_STATUSES.join(', ')}` });
  }

  await inTransaction(res, 'TB screening', async (client) => {
    // Same row lock as POST /api/tb/:visitId/flag, so the two cannot interleave.
    const visit = await client.query('SELECT id FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
    if (!visit.rows.length) return { status: 404, body: { error: 'Visit not found' } };
    const screening = await client.query('SELECT status FROM tb_screening WHERE visit_id = $1', [visitId]);
    if (!screening.rows.length) return { status: 404, body: { error: 'This visit was not flagged for TB' } };

    const statusChanged = status !== undefined && status !== screening.rows[0].status;

    const { rows } = await client.query(
      `UPDATE tb_screening SET
         red_flags = COALESCE($2::text[], red_flags),
         flag_notes = COALESCE($3, flag_notes),
         doctor_notes = COALESCE($4, doctor_notes),
         status = COALESCE($5, status),
         -- A first result recorded here is attributed to the admin who recorded it.
         reviewed_by = CASE WHEN $6 AND reviewed_at IS NULL THEN $7 ELSE reviewed_by END,
         reviewed_at = CASE WHEN $6 AND reviewed_at IS NULL THEN NOW() ELSE reviewed_at END,
         last_updated_by = $7, last_updated_at = NOW()
       WHERE visit_id = $1
       RETURNING visit_id, red_flags, flag_notes, status, doctor_notes, reviewed_at, last_updated_at, last_updated_by`,
      [
        visitId,
        redFlags ?? null,
        flag_notes === undefined ? null : textOrEmpty(flag_notes),
        doctor_notes === undefined ? null : textOrEmpty(doctor_notes),
        statusChanged ? status : null,
        statusChanged,
        req.user.id,
      ]
    );
    return { status: 200, body: rows[0] };
  });
});

module.exports = router;
