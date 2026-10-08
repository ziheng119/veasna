// utils/queueNumber.js
// Queue numbers are sequential per location per visit date, starting at 1.

const QUEUE_LOCK_NAMESPACE = 7101;

function currentVisitDate() {
  return new Date().toISOString().slice(0, 10);
}

// Serializes queue number assignment for a location until the surrounding transaction ends,
// so two devices registering at the same time cannot be given the same number.
function lockQueue(client, locationId) {
  return client.query('SELECT pg_advisory_xact_lock($1, $2)', [QUEUE_LOCK_NAMESPACE, locationId]);
}

// Next number after the highest one issued for the location and date. Completed visits count,
// so numbers are not reused, and legacy suffixed values such as "12A" count as 12.
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
  currentVisitDate,
  lockQueue,
  getNextQueueNo,
};
