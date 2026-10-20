require('dotenv').config();
const db = require('../config/db');
const { ensureUserRole } = require('../utils/ensureSchema');
const { ensurePasswordColumn } = require('../routes/session');

const STATION_ACCOUNTS = [
  ['clinic_admin', 'admin'],
  ['registration', 'registration'],
  ['triage_doctor', 'triage'],
  ['tb_doctor', 'tb'],
  ['seva_doctor', 'seva'],
  ['physio_doctor', 'physiotherapy'],
  ['consult_doctor', 'consultation'],
  ['pharmacist', 'pharmacy'],
];

// Explicit starter setup, never automatic on server boot. Preserve existing
// accounts (including passwords, roles and disabled state) on every rerun.
async function seedStationUsers() {
  await ensureUserRole();
  await ensurePasswordColumn();
  const results = [];
  for (const [username, role] of STATION_ACCOUNTS) {
    const hash = await db.hashPassword(username);
    const { rows } = await db.query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT ((LOWER(username))) DO NOTHING
      RETURNING username, role
    `, [username, hash, role]);
    results.push({ username, role, created: rows.length > 0 });
  }
  return results;
}

if (require.main === module) {
  seedStationUsers().then(results => {
    for (const item of results) console.log(`${item.username}: ${item.created ? `created (${item.role})` : 'already exists; unchanged'}`);
  }).catch(error => {
    console.error('Station account setup failed:', error.message);
    process.exitCode = 1;
  }).finally(() => db.pool.end());
}
module.exports = { STATION_ACCOUNTS, seedStationUsers };
