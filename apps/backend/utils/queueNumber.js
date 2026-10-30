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
async function getNextQueueNo(client, locationId, visitDate) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(substring(queue_no from '^[0-9]{1,9}')::int), 0) + 1 AS next_queue_no
     FROM visits
     WHERE location_id = $1 AND visit_date = $2::date`,
    [locationId, visitDate]
  );
  return String(rows[0].next_queue_no);
}

module.exports = {
  QUEUE_NO_ERROR,
  normalizeQueueNo,
  isValidQueueNo,
  isQueueNoTaken,
  currentVisitDate,
  lockQueue,
  getNextQueueNo,
};
