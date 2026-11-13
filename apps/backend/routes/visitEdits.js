// routes/visitEdits.js
// Corrections to a saved visit, used by the Patient Details page. Any account may correct a visit
// (utils/permissions.js canEditSavedRecords); deleting a visit stays admin-only.
//
// Station notes (triage, SEVA, physiotherapy, consultation, referral) are edited through their
// existing upsert endpoints, which also overwrite a saved row. This router covers
// the parts of a visit that have no such endpoint:
//   PUT /api/visits/:visitId         visit details: queue number, visit date, sticker
//   PUT /api/visits/:visitId/vitals  vitals and HEF captured at registration
//   PUT /api/visits/:visitId/tb      TB screening record (red flags, notes, flag status)
//   DELETE /api/visits/:visitId      the whole visit and every record of it (e.g. entered in error)
// Every write records the account in last_updated_by and bumps last_updated_at for sync/audit.
const express = require('express');
const router = express.Router();
const { integerParams } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['visitId']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');
const { lockQueue, getNextQueueNo, normalizeQueueNo, isValidQueueNo, queueNoJumpError, QUEUE_NO_ERROR } = require('../utils/queueNumber');
const { textOrEmpty } = require('../utils/partialFields');
const { normalizeVitals } = require('../utils/vitals');
const { TB_STATUSES, TB_FLAGGED_STATUSES, TB_MIN_RED_FLAGS, TB_MIN_RED_FLAGS_ERROR, normalizeRedFlags } = require('../utils/tb');
const { lockFamilies, releaseFamily } = require('../utils/familyMoves');
const { normalizeStickerColour } = require('../utils/formOptions');
const { workingDay } = require('../utils/dayScope');
const { hasPermission } = require('../utils/permissions');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Applied per route: a router-level guard would also block GET /api/visits/* for users,
// because this router shares the /visits mount point with routes/visits.js.
const editors = [authenticateToken, requireRole(['admin', 'user'])];
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
// Body: { queue_no?, visit_date? (YYYY-MM-DD), sticker_colour? (blank = none) }.
// Omitted fields keep their value.
router.put('/:visitId', ...editors, async (req, res) => {
  const visitId = parsePositiveInt(req.params.visitId);
  if (!visitId) return res.status(400).json({ error: 'Visit ID must be a positive integer' });

  const { queue_no, visit_date } = req.body;
  const queueNo = queue_no === undefined ? undefined : normalizeQueueNo(queue_no);
  if (queueNo !== undefined && !isValidQueueNo(queueNo)) {
    return res.status(400).json({ error: QUEUE_NO_ERROR });
  }
  if (visit_date !== undefined && !isValidDate(visit_date)) {
    return res.status(400).json({ error: 'visit_date must be a valid date (YYYY-MM-DD)' });
  }
  // Without edit_past an account may only change its own day's visits (utils/dayScope.js), so it
  // can't move one to another date either.
  const day = workingDay(req.user);
  if (day && !hasPermission(req.user, 'edit_past') && visit_date !== undefined && visit_date !== day) {
    return res.status(403).json({ error: `This account can only keep visits on its screening day, ${day}.` });
  }
  let stickerColour;
  if (req.body.sticker_colour !== undefined) {
    try {
      stickerColour = await normalizeStickerColour(req.body.sticker_colour);
    } catch (err) {
      console.error('Failed to load sticker colours:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (stickerColour.error) return res.status(400).json({ error: stickerColour.error });
  }
  if (queueNo === undefined && visit_date === undefined && stickerColour === undefined) {
    return res.status(400).json({ error: 'Provide at least one of queue_no, visit_date or sticker_colour' });
  }

  await inTransaction(res, 'visit details', async (client) => {
    const current = await client.query(
      `SELECT id, queue_no, TO_CHAR(visit_date, 'YYYY-MM-DD') AS visit_date, sticker_colour FROM visits WHERE id = $1 FOR UPDATE`,
      [visitId]
    );
    if (!current.rows.length) return { status: 404, body: { error: 'Visit not found' } };
    const saved = current.rows[0];

    const next = {
      queue_no: queueNo ?? saved.queue_no,
      visit_date: visit_date ?? saved.visit_date,
      sticker_colour: stickerColour === undefined ? saved.sticker_colour : stickerColour.value,
    };
    // Same lock as registration, so a new patient cannot take this number concurrently.
    await lockQueue(client);
    // Only a changed number or move is checked, so older numbers can be kept as they are.
    const moved = next.queue_no !== saved.queue_no || next.visit_date !== saved.visit_date;
    if (moved) {
      const jumpError = queueNoJumpError(next.queue_no, await getNextQueueNo(client, next.visit_date, visitId));
      if (jumpError) return { status: 400, body: { error: jumpError } };
    }
    const duplicate = await client.query(
      `SELECT 1 FROM visits
       WHERE id <> $1 AND visit_date = $2::date AND UPPER(queue_no) = $3`,
      [visitId, next.visit_date, next.queue_no]
    );
    if (duplicate.rows.length) {
      return { status: 409, body: { error: `Queue number ${next.queue_no} is already used on ${next.visit_date}` } };
    }

    const { rows } = await client.query(
      `UPDATE visits
       SET queue_no = $2, visit_date = $3::date, sticker_colour = $5, last_updated_by = $4, last_updated_at = NOW()
       WHERE id = $1
       RETURNING id AS visit_id, patient_id, queue_no, TO_CHAR(visit_date, 'YYYY-MM-DD') AS visit_date,
         sticker_colour, last_updated_at, last_updated_by`,
      [visitId, next.queue_no, next.visit_date, req.user.id, next.sticker_colour]
    );
    return { status: 200, body: rows[0] };
  });
});

// PUT /api/visits/:visitId/vitals
// Body: { vitals?: { height, weight, bmi, below_3rd_percentile, bp_systolic, bp_diastolic,
//         temperature, notes }, hef?: { know_of_hef, has_hef, has_nssf?, uses_hef_nssf?, notes } }
// Either section may be sent alone. A missing row is created, so a visit can be backfilled.
// has_nssf and uses_hef_nssf are true, false or null (not asked); left out, they keep their value.
router.put('/:visitId/vitals', ...editors, async (req, res) => {
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
  if (hef != null && ['has_nssf', 'uses_hef_nssf'].some((field) => ![undefined, null, true, false].includes(hef[field]))) {
    return res.status(400).json({ error: 'hef.has_nssf and hef.uses_hef_nssf must be true, false or null' });
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
        `INSERT INTO hef (visit_id, know_of_hef, has_hef, notes, last_updated_by, has_nssf, uses_hef_nssf)
         VALUES ($1, $2, $3, $4, $5, $6, $8)
         ON CONFLICT (visit_id) DO UPDATE SET
           know_of_hef = EXCLUDED.know_of_hef, has_hef = EXCLUDED.has_hef, notes = EXCLUDED.notes,
           has_nssf = CASE WHEN $7 THEN EXCLUDED.has_nssf ELSE hef.has_nssf END,
           uses_hef_nssf = CASE WHEN $9 THEN EXCLUDED.uses_hef_nssf ELSE hef.uses_hef_nssf END,
           last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()
         RETURNING *`,
        [visitId, hef.know_of_hef, hef.has_hef, textOrEmpty(hef.notes), req.user.id,
          hef.has_nssf ?? null, hef.has_nssf !== undefined, hef.uses_hef_nssf ?? null, hef.uses_hef_nssf !== undefined]
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
router.put('/:visitId/tb', ...editors, async (req, res) => {
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
    const screening = await client.query('SELECT status, red_flags FROM tb_screening WHERE visit_id = $1', [visitId]);
    if (!screening.rows.length) return { status: 404, body: { error: 'This visit was not flagged for TB' } };
    const saved = screening.rows[0];

    const statusChanged = status !== undefined && status !== saved.status;
    // A flag must keep at least TB_MIN_RED_FLAGS red flags. Only a change is checked, so older
    // flags with fewer can still have their notes corrected.
    const flagsChanged = redFlags !== undefined && [...redFlags].sort().join() !== [...saved.red_flags].sort().join();
    const flaggedAfter = TB_FLAGGED_STATUSES.includes(status ?? saved.status);
    if ((statusChanged || flagsChanged) && flaggedAfter && (redFlags ?? saved.red_flags).length < TB_MIN_RED_FLAGS) {
      return { status: 400, body: { error: TB_MIN_RED_FLAGS_ERROR } };
    }

    const { rows } = await client.query(
      `UPDATE tb_screening SET
         red_flags = COALESCE($2::text[], red_flags),
         flag_notes = COALESCE($3, flag_notes),
         doctor_notes = COALESCE($4, doctor_notes),
         status = COALESCE($5, status),
         -- A first result recorded here is attributed to the account that recorded it.
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

// DELETE /api/visits/:visitId - Removes the visit with its station records, referral, TB record
// and prescriptions (ON DELETE CASCADE). Pending prescriptions release their reserved stock, since
// reserved stock is the sum of pending prescriptions. Family members who were waiting at a station
// for this visit move on. The patient stays, with their other visits.
router.delete('/:visitId', ...adminOnly, async (req, res) => {
  const visitId = parsePositiveInt(req.params.visitId);
  await inTransaction(res, 'visit', async (client) => {
    await lockFamilies(client);
    const { rows } = await client.query(
      `DELETE FROM visits v USING patients p WHERE v.id = $1 AND p.id = v.patient_id
       RETURNING v.id AS visit_id, v.patient_id, TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, p.family`,
      [visitId]
    );
    if (!rows.length) return { status: 404, body: { error: 'Visit not found. It may have been deleted on another device.' } };
    const deleted = rows[0];
    if (deleted.family) await releaseFamily(client, deleted, deleted.family, req.user.id);
    return { status: 200, body: { visit_id: deleted.visit_id, patient_id: deleted.patient_id } };
  });
});

module.exports = router;
