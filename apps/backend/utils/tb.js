// utils/tb.js
// Suspected TB is a flag on the visit, kept in tb_screening. A flagged visit goes only to the
// Consultation queue (TB_ROUTE), marked in red in every queue: the doctor sees the patient in the
// TB tent and clears the flag there. If the doctor prescribes, Pharmacy is added after it, as for
// any patient. Staff cannot edit the route of a visit that was ever flagged.
//   status 'suspected' = flagged; 'cleared' = flag removed (no TB);
//   'tb_likely' = flagged (older records reviewed at the former TB Tent).

const { toPositiveInt } = require('./validation');

const TB_STATUSES = ['suspected', 'cleared', 'tb_likely'];
const TB_FLAGGED_STATUSES = ['suspected', 'tb_likely'];

// A patient is flagged for suspected TB only with at least this many red flags (symptoms).
// Must match TB_MIN_RED_FLAGS in apps/frontend/src/constants/tb.ts.
const TB_MIN_RED_FLAGS = 3;
const TB_MIN_RED_FLAGS_ERROR = `A patient is flagged for suspected TB only with ${TB_MIN_RED_FLAGS} or more red flags.`;

// Red flags are short keys or labels chosen at registration or triage; free text goes in notes.
function normalizeRedFlags(input) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  const flags = input.map((flag) => (typeof flag === 'string' ? flag.trim() : ''));
  if (flags.some((flag) => flag === '' || flag.length > 100)) return null;
  return [...new Set(flags)];
}

// Express helper for station form saves: responds 404 and returns true when the visit does not
// exist (e.g. deleted on another device), so the form is not saved against a missing visit.
async function rejectUnsavableVisit(client, res, visitId) {
  const id = toPositiveInt(visitId);
  if (id === null) {
    res.status(400).json({ error: 'Valid visit_id is required' });
    return true;
  }
  const { rows } = await client.query('SELECT EXISTS (SELECT 1 FROM visits WHERE id = $1) AS found', [id]);
  if (!rows[0]?.found) {
    res.status(404).json({ error: 'Visit not found. It may have been deleted on another device.' });
    return true;
  }
  return false;
}

// Flags the visit for suspected TB, creating its screening record or re-flagging a cleared one.
// Red flags and notes are only replaced when new ones are given.
async function flagTb(client, visitId, { redFlags = [], notes = '' }, userId) {
  const { rows } = await client.query(
    `INSERT INTO tb_screening (visit_id, red_flags, flag_notes, status, flagged_by, last_updated_by)
     VALUES ($1, $2, $3, 'suspected', $4, $4)
     ON CONFLICT (visit_id) DO UPDATE SET
        red_flags = CASE WHEN cardinality(EXCLUDED.red_flags) > 0 THEN EXCLUDED.red_flags ELSE tb_screening.red_flags END,
        flag_notes = CASE WHEN EXCLUDED.flag_notes <> '' THEN EXCLUDED.flag_notes ELSE tb_screening.flag_notes END,
        status = CASE WHEN tb_screening.status = 'tb_likely' THEN 'tb_likely' ELSE 'suspected' END,
        last_updated_by = EXCLUDED.last_updated_by,
        last_updated_at = NOW()
     RETURNING visit_id, red_flags, flag_notes, status`,
    [visitId, redFlags, notes, userId]
  );
  return rows[0];
}

// The only station a TB visit is sent to: the doctor sees them at Consultation (in the TB tent).
// Pharmacy is added after it when the doctor prescribes, and is kept by sendToConsultation.
const TB_ROUTE = ['consultation'];
const TB_ROUTE_LOCKED_ERROR = 'This patient was flagged for suspected TB, so they only go to Consult and their stations cannot be changed.';

// True when the visit was ever flagged for TB (flagged or cleared): its route is then fixed.
async function isTbVisit(client, visitId) {
  const { rows } = await client.query('SELECT EXISTS (SELECT 1 FROM tb_screening WHERE visit_id = $1) AS tb', [visitId]);
  return Boolean(rows[0]?.tb);
}

// Makes Consultation the visit's only remaining station (apart from a Pharmacy stop for a
// prescription): other unfinished stations are removed and Consultation is added when missing. Nothing changes when the visit is discharged, the route is
// already just Consultation, or Consultation is already finished (the doctor has seen them). The old
// route is kept in visit_station_route_history, as for any route edit. The caller must hold the
// visit's row lock. Returns the current station afterwards (null when discharged or finished).
async function sendToConsultation(client, visitId, userId) {
  const visit = await client.query('SELECT completed_at FROM visits WHERE id = $1', [visitId]);
  if (!visit.rows.length || visit.rows[0].completed_at) return null;
  const { rows: route } = await client.query('SELECT * FROM visit_stations WHERE visit_id = $1 ORDER BY position, id', [visitId]);
  const pending = route.filter((row) => !row.completed_at).map((row) => row.station);
  const consultationDone = route.some((row) => row.station === 'consultation' && row.completed_at);
  const kept = pending.filter((station) => station !== 'pharmacy');
  if (consultationDone || kept.join() === TB_ROUTE.join()) return pending[0] ?? null;

  await client.query(
    'INSERT INTO visit_station_route_history (visit_id, previous_stations, requested_stations, last_updated_by) VALUES ($1, $2::jsonb, $3::jsonb, $4)',
    [visitId, JSON.stringify(route), JSON.stringify([...TB_ROUTE, ...pending.filter((s) => s === 'pharmacy')]), userId]
  );
  await client.query(
    "DELETE FROM visit_stations WHERE visit_id = $1 AND completed_at IS NULL AND station NOT IN ('consultation', 'pharmacy')",
    [visitId]
  );
  // Pharmacy, if already added, stays after Consultation.
  await client.query("UPDATE visit_stations SET position = 2 WHERE visit_id = $1 AND station = 'pharmacy' AND completed_at IS NULL", [visitId]);
  // A patient already waiting at Consultation keeps their place; otherwise they arrive now.
  await client.query(
    `INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
     VALUES ($1, 'consultation', 1, NOW(), $2)
     ON CONFLICT (visit_id, station) DO UPDATE SET
        position = 1, entered_at = CASE WHEN $3 THEN visit_stations.entered_at ELSE NOW() END,
        last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()`,
    [visitId, userId, pending[0] === 'consultation']
  );
  return 'consultation';
}

// Removes the flag. The record is kept (status 'cleared') for the audit trail.
async function clearTbFlag(client, visitId, userId) {
  const { rows } = await client.query(
    `UPDATE tb_screening
     SET status = 'cleared', reviewed_by = $2, reviewed_at = NOW(), last_updated_by = $2, last_updated_at = NOW()
     WHERE visit_id = $1
     RETURNING visit_id, red_flags, flag_notes, status`,
    [visitId, userId]
  );
  return rows[0] || null;
}

module.exports = {
  TB_STATUSES,
  TB_FLAGGED_STATUSES,
  TB_MIN_RED_FLAGS,
  TB_MIN_RED_FLAGS_ERROR,
  normalizeRedFlags,
  rejectUnsavableVisit,
  flagTb,
  clearTbFlag,
  TB_ROUTE,
  TB_ROUTE_LOCKED_ERROR,
  isTbVisit,
  sendToConsultation,
};
