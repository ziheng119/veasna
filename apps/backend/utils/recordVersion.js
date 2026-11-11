// utils/recordVersion.js
// Station forms (Triage sections, Dental, partner NGO, Physiotherapy, Consult notes, the referral)
// and Patient Details send
// `expected_updated_at`: the last_updated_at of the record the form last loaded or saved, or null
// when there was none. If the record was saved since (on a device that missed the live update),
// the save is refused with 409 and the form offers the saved version. Without the field (older
// apps) the save goes through, and the later save is kept.
//
// Compared as ISO strings: both sides come from the same pg parsing of last_updated_at. The check
// and the save are separate statements, so two saves within the same instant both go through.

const CHANGED = 'This form was saved on another device after you opened it. Choose which version to keep, then save again.';

// Sends 409 (or 400) and returns true when the save must not go ahead. The record is the row of
// `table` whose `column` is `id` (a visit's record by default).
async function rejectChangedRecord(db, res, table, id, expected, { column = 'visit_id', message = CHANGED } = {}) {
  if (expected === undefined) return false;
  if (expected !== null && (typeof expected !== 'string' || Number.isNaN(Date.parse(expected)))) {
    res.status(400).json({ error: 'expected_updated_at must be a date and time, or null.' });
    return true;
  }
  const { rows } = await db.query(`SELECT last_updated_at FROM ${table} WHERE ${column} = $1`, [id]);
  const current = rows.length ? new Date(rows[0].last_updated_at).toISOString() : null;
  if (current === (expected && new Date(expected).toISOString())) return false;
  res.status(409).json({ error: message, last_updated_at: rows.length ? rows[0].last_updated_at : null });
  return true;
}

module.exports = { rejectChangedRecord };
