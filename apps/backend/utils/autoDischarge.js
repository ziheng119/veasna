// Each clinic day starts afresh: a visit still open once its day has ended (on the host's
// calendar) is discharged automatically, so it leaves every queue and the "not discharged"
// follow-up list. It is marked auto_discharged so it stays apart from a discharge by staff;
// last_updated_by keeps the last person who changed it.
const db = require('../config/db');
const { currentVisitDate } = require('./queueNumber');

const SWEEP_INTERVAL_MS = 60 * 1000;

// Discharges open visits dated before `today` (YYYY-MM-DD). Resolves to the number discharged.
async function dischargePastVisits(today = currentVisitDate()) {
  const result = await db.query(
    `UPDATE visits SET completed_at = NOW(), auto_discharged = TRUE, last_updated_at = NOW()
     WHERE completed_at IS NULL AND visit_date < $1::date`,
    [today]
  );
  return result.rowCount;
}

// Runs once now and then every minute, so the day resets soon after midnight.
function scheduleAutoDischarge(log = console) {
  const sweep = () => dischargePastVisits()
    .then((count) => { if (count) log.log(`Discharged ${count} visit(s) left open from earlier days.`); })
    .catch((error) => log.error(`Auto-discharge failed: ${error.message}`));
  sweep();
  const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { dischargePastVisits, scheduleAutoDischarge };
