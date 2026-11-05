// utils/tb.js
// Suspected TB is a flag on the visit, kept in tb_screening. A flagged visit goes straight to the
// Consultation queue, marked in red in every queue, so a doctor sees the patient (in the TB tent)
// first. Anyone can clear the flag; the patient then stays at, or returns to, Consultation, since
// the doctor's tent visit is their consultation. Their other unfinished stations stay queued after it.
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

// The route a TB-flagged visit takes: Consultation first, then its other stations in order.
function consultationFirst(stations) {
  return ['consultation', ...stations.filter((station) => station !== 'consultation')];
}

// Makes Consultation the visit's current station, ahead of its other unfinished stations, adding it
// when missing. Nothing changes when the visit is discharged, Consultation is already current, or
// Consultation is already finished. The old route is kept in visit_station_route_history, as for any
// route edit. The caller must hold the visit's row lock. Returns the current station afterwards
// (null when the visit is discharged or finished).
async function sendToConsultation(client, visitId, userId) {
  const visit = await client.query('SELECT completed_at FROM visits WHERE id = $1', [visitId]);
  if (!visit.rows.length || visit.rows[0].completed_at) return null;
  const { rows: route } = await client.query('SELECT * FROM visit_stations WHERE visit_id = $1 ORDER BY position, id', [visitId]);
  const pending = route.filter((row) => !row.completed_at).map((row) => row.station);
  const consultationDone = route.some((row) => row.station === 'consultation' && row.completed_at);
  if (consultationDone || pending[0] === 'consultation') return pending[0] ?? null;

  const wanted = consultationFirst(pending);
  await client.query(
    'INSERT INTO visit_station_route_history (visit_id, previous_stations, requested_stations, last_updated_by) VALUES ($1, $2::jsonb, $3::jsonb, $4)',
    [visitId, JSON.stringify(route), JSON.stringify(wanted), userId]
  );
  // Consultation gets a new arrival time; the station the patient left waits without one until
  // it becomes current again, as when a station is skipped.
  for (const [index, station] of wanted.entries()) {
    await client.query(
      `INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
       VALUES ($1, $2, $3, CASE WHEN $4 THEN NOW() END, $5)
       ON CONFLICT (visit_id, station) DO UPDATE SET
          position = EXCLUDED.position, entered_at = EXCLUDED.entered_at,
          last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()`,
      [visitId, station, index + 1, index === 0, userId]
    );
  }
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
  consultationFirst,
  sendToConsultation,
};
