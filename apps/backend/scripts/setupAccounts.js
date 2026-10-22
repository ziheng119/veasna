require('dotenv').config();
const db = require('../config/db');
const { ensureUserRole } = require('../utils/ensureSchema');
const { ensurePasswordColumn } = require('../routes/session');

// Explicit operator command, never run automatically: resets the two credentials.
// Retire other logins rather than delete rows referenced by historical clinical records.
async function setupAccounts() {
  await ensureUserRole();
  await ensurePasswordColumn();
  const hashes = await Promise.all(['admin12345', 'user'].map(password => db.hashPassword(password)));
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    await client.query("UPDATE users SET is_active=FALSE WHERE LOWER(username) NOT IN ('admin','user')");
    const accounts = [];
    for (const [index, name] of ['admin', 'user'].entries()) {
      const { rows } = await client.query(`INSERT INTO users (username,password_hash,role,is_active)
        VALUES ($1,$2,$1,TRUE)
        ON CONFLICT ((LOWER(username))) DO UPDATE SET
          username=EXCLUDED.username, password_hash=EXCLUDED.password_hash,
          role=EXCLUDED.role, is_active=TRUE
        RETURNING id,username,role`, [name, hashes[index]]);
      accounts.push(rows[0]);
    }
    await client.query('COMMIT');
    return accounts;
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
if (require.main === module) {
  setupAccounts().then(accounts => console.log('Active accounts:', accounts.map(account => account.username).join(', ')))
    .catch(error => { console.error('Account setup failed:', error.message); process.exitCode=1; })
    .finally(() => db.pool.end());
}
module.exports = { setupAccounts };
