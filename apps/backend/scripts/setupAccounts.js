require('../config/env').loadEnv();
const db = require('../config/db');
const { ensureDayAccountsAndFormOptions } = require('../utils/ensureSchema');
const { ensurePasswordColumn } = require('../routes/session');

// Explicit operator command, never run automatically: resets the admin sign-in.
// Every other fixed login (including the old shared "user" account) is retired rather than deleted,
// because historical clinical records refer to it. Screening-day accounts (made by an admin on the
// Accounts page) are left as they are; they are how everyone else signs in.
const FIXED_ACCOUNTS = [{ username: 'admin', password: 'admin12345', role: 'admin' }];

async function setupAccounts() {
  await ensureDayAccountsAndFormOptions();
  await ensurePasswordColumn();
  const hashes = await Promise.all(FIXED_ACCOUNTS.map(account => db.hashPassword(account.password)));
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    await client.query(
      'UPDATE users SET is_active=FALSE WHERE NOT (LOWER(username) = ANY($1::text[])) AND screening_date IS NULL',
      [FIXED_ACCOUNTS.map(account => account.username)]);
    const accounts = [];
    for (const [index, { username: name, role }] of FIXED_ACCOUNTS.entries()) {
      const { rows } = await client.query(`INSERT INTO users (username,password_hash,role,is_active)
        VALUES ($1,$2,$3,TRUE)
        ON CONFLICT ((LOWER(username))) DO UPDATE SET
          username=EXCLUDED.username, password_hash=EXCLUDED.password_hash,
          role=EXCLUDED.role, is_active=TRUE, screening_date=NULL
        RETURNING id,username,role`, [name, hashes[index], role]);
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
module.exports = { setupAccounts, FIXED_ACCOUNTS };
