// utils/tb.js
// TB hold: a visit whose TB tent station is not yet completed. The TB tent station is only
// completed when a TB doctor records that the patient is cleared (routes/tb.js).

const { toPositiveInt } = require('./validation');

const TB_STATION = 'tb';
const TB_STATUSES = ['suspected', 'cleared', 'tb_likely'];
const TB_HOLD_MESSAGE =
  'This patient is flagged for suspected TB. They must stay in the TB tent until a TB doctor clears them.';

// Red flags are short keys or labels chosen at registration; free text goes in notes.
function normalizeRedFlags(input) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  const flags = input.map((flag) => (typeof flag === 'string' ? flag.trim() : ''));
  if (flags.some((flag) => flag === '' || flag.length > 100)) return null;
  return [...new Set(flags)];
}

// Express helper for station form saves: responds and returns true when the form cannot be
// saved, because the visit does not exist (e.g. deleted on another device: 404) or is on
// TB hold (409). One query covers both checks.
async function rejectUnsavableVisit(client, res, visitId) {
  const id = toPositiveInt(visitId);
  if (id === null) {
    res.status(400).json({ error: 'Valid visit_id is required' });
    return true;
  }
  const { rows } = await client.query(
    `SELECT EXISTS (SELECT 1 FROM visits WHERE id = $1) AS found,
            EXISTS (SELECT 1 FROM visit_stations WHERE visit_id = $1 AND station = $2 AND completed_at IS NULL) AS on_hold`,
    [id, TB_STATION]
  );
  if (!rows[0]?.found) {
    res.status(404).json({ error: 'Visit not found. It may have been deleted on another device.' });
    return true;
  }
  if (rows[0].on_hold) {
    res.status(409).json({ error: TB_HOLD_MESSAGE, code: 'TB_HOLD' });
    return true;
  }
  return false;
}

// Creates the visit's TB screening as suspected, or re-opens an earlier one.
async function flagTb(client, visitId, { redFlags = [], notes = '' }, userId) {
  await client.query(
    `INSERT INTO tb_screening (visit_id, red_flags, flag_notes, status, flagged_by, last_updated_by)
     VALUES ($1, $2, $3, 'suspected', $4, $4)
     ON CONFLICT (visit_id) DO UPDATE SET
        red_flags = CASE WHEN cardinality(EXCLUDED.red_flags) > 0 THEN EXCLUDED.red_flags ELSE tb_screening.red_flags END,
        flag_notes = CASE WHEN EXCLUDED.flag_notes <> '' THEN EXCLUDED.flag_notes ELSE tb_screening.flag_notes END,
        status = 'suspected',
        reviewed_by = NULL,
        reviewed_at = NULL,
        last_updated_by = EXCLUDED.last_updated_by,
        last_updated_at = NOW()`,
    [visitId, redFlags, notes, userId]
  );
}

module.exports = {
  TB_STATION,
  TB_STATUSES,
  TB_HOLD_MESSAGE,
  normalizeRedFlags,
  rejectUnsavableVisit,
  flagTb,
};
