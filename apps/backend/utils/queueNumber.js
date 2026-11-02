// utils/queueNumber.js
// Queue numbers are issued sequentially per location per visit date, starting at 1. Staff may
// instead type one in, e.g. "12A" for a family member of 12 or "A12" for a lettered series.
// They are stored as text, upper-cased, and must be unique per location and date.

const { localDate } = require('./validation');

const QUEUE_LOCK_NAMESPACE = 7101;

// 1-10 letters and digits, at least one of them a digit: 12, 12A, A12, B3C.
const QUEUE_NO_PATTERN = /^(?=.*[0-9])[A-Z0-9]{1,10}$/;
const QUEUE_NO_ERROR = 'Queue number must be 1-10 letters and digits with at least one digit, e.g. 12, 12A or A12.';

// Trimmed and upper-cased; '' when nothing was given.
function normalizeQueueNo(value) {
  return value === undefined || value === null ? '' : String(value).trim().toUpperCase();
}

function isValidQueueNo(queueNo) {
  return QUEUE_NO_PATTERN.test(queueNo);
}

// Refuses a typed number that runs ahead of the sequence, which would make every later assigned
// number skip. With next number 14: "132" (a mistyped "13A") and "20A" (there is no 20 yet) are
// refused; "14", a free gap such as "9", and "13A" are allowed. Numbers that start with a letter
// ("A12") are a separate series and always allowed. Returns an error message, or null when allowed.
// Must match apps/frontend/src/lib/queueNumber.ts.
function queueNoJumpError(queueNo, nextQueueNo) {
  const digits = /^[0-9]+/.exec(queueNo)?.[0];
  if (!digits) return null;
  const base = Number(digits);
  const next = Number(nextQueueNo);
  if (digits === queueNo) {
    if (base <= next) return null;
    // The longest leading part that is already issued, e.g. 13 for "132", to suggest "13A".
    let prefix = digits.slice(0, -1);
    while (prefix && !(Number(prefix) >= 1 && Number(prefix) < next)) prefix = prefix.slice(0, -1);
    const group = prefix ? ` To group with patient ${Number(prefix)}, add a letter, e.g. ${Number(prefix)}A.` : '';
    return `Queue number ${queueNo} is ahead of the next number, ${next}.${group} Leave it blank to use ${next}.`;
  }
  if (base < next) return null;
  return `No patient has number ${base} yet, so ${queueNo} can't be used. The next number is ${next}.`;
}

// True when another visit at the location and date already has this number (any letter case).
async function isQueueNoTaken(client, locationId, visitDate, queueNo, exceptVisitId = null) {
  const { rows } = await client.query(
    `SELECT 1 FROM visits
     WHERE location_id IS NOT DISTINCT FROM $1 AND visit_date = $2::date AND UPPER(queue_no) = $3
       AND ($4::int IS NULL OR id <> $4)
     LIMIT 1`,
    [locationId, visitDate, queueNo, exceptVisitId]
  );
  return rows.length > 0;
}

// Today's clinic date in the backend host's time zone (not UTC: in Cambodia the UTC
// date only changes at 07:00, which would split a morning's queue across two days).
function currentVisitDate() {
  return localDate();
}

// Serializes queue number assignment for a location until the surrounding transaction ends,
// so two devices registering at the same time cannot be given the same number.
function lockQueue(client, locationId) {
  return client.query('SELECT pg_advisory_xact_lock($1, $2)', [QUEUE_LOCK_NAMESPACE, locationId]);
}

// Next number after the highest one issued for the location and date. Completed visits count,
// so numbers are not reused; suffixed values such as "12A" count as 12, and numbers that start
// with a letter ("A12") are a separate series and do not affect it.
// exceptVisitId leaves one visit out, for checking a change to that visit's own number.
async function getNextQueueNo(client, locationId, visitDate, exceptVisitId = null) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(substring(queue_no from '^[0-9]{1,9}')::int), 0) + 1 AS next_queue_no
     FROM visits
     WHERE location_id = $1 AND visit_date = $2::date AND ($3::int IS NULL OR id <> $3)`,
    [locationId, visitDate, exceptVisitId]
  );
  return String(rows[0].next_queue_no);
}

module.exports = {
  QUEUE_NO_ERROR,
  normalizeQueueNo,
  isValidQueueNo,
  queueNoJumpError,
  isQueueNoTaken,
  currentVisitDate,
  lockQueue,
  getNextQueueNo,
};
