// utils/recordVersion.js
// Station forms (Triage sections, Dental, partner NGO, Physiotherapy, Consult notes, the referral)
// and Patient Details send
// `expected_updated_at`: the last_updated_at of the record the form last loaded or saved, or null
// when there was none. If the record was saved since (on a device that missed the live update),
// the save is refused with 409 and the form offers the saved version. Without the field (older
// apps) the save goes through, and the later save is kept.
//
// Compared as ISO strings: both sides come from the same pg parsing of last_updated_at.
//
// Saves to the same record take turns: each holds the record from this check until its response
// is sent, so the check and the route's save act as one step. Of several devices saving the same
// version at once, the first is kept and the others get 409 instead of overwriting it. The
// backend is one process on the host laptop, so an in-memory queue is enough.

const CHANGED = 'This form was saved on another device after you opened it. Choose which version to keep, then save again.';

// A save that never answers (a route bug) frees its record after this long.
const HOLD_LIMIT_MS = 30000;
// A request whose device disconnected while it waited still saves; it keeps the record this long.
const DISCONNECTED_HOLD_MS = 2000;

// record key -> the promise the last save in line resolves when it is done.
const queues = new Map();

// Waits for earlier saves to this record, then holds it until `res` is sent or the connection closes.
async function holdRecord(key, res) {
  const before = queues.get(key) ?? Promise.resolve();
  let done;
  const mine = new Promise((resolve) => { done = resolve; });
  queues.set(key, mine);
  await before;

  let timer;
  const release = () => {
    clearTimeout(timer);
    res.off('finish', release);
    res.off('close', release);
    if (queues.get(key) === mine) queues.delete(key);
    done();
  };
  const closed = res.writableFinished || res.destroyed || res.closed;
  timer = setTimeout(release, closed ? DISCONNECTED_HOLD_MS : HOLD_LIMIT_MS);
  timer.unref?.();
  if (!closed) {
    res.once('finish', release);
    res.once('close', release);
  }
}

// Sends 409 (or 400) and returns true when the save must not go ahead. The record is the row of
// `table` whose `column` is `id` (a visit's record by default). Call it right before the save.
async function rejectChangedRecord(db, res, table, id, expected, { column = 'visit_id', message = CHANGED } = {}) {
  await holdRecord(`${table}:${column}:${String(id).trim()}`, res);
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
