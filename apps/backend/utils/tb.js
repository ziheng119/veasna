// utils/tb.js
// Suspected TB is a flag on the visit, kept in tb_screening. A flagged visit goes through its
// normal stations and is marked in red in every queue so doctors can attend to it.
//   status 'suspected' = flagged; 'cleared' = flag removed (no TB);
//   'tb_likely' = flagged (older records reviewed at the former TB Tent).

const { toPositiveInt } = require('./validation');

const TB_STATUSES = ['suspected', 'cleared', 'tb_likely'];
const TB_FLAGGED_STATUSES = ['suspected', 'tb_likely'];

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
  normalizeRedFlags,
  rejectUnsavableVisit,
  flagTb,
  clearTbFlag,
};
