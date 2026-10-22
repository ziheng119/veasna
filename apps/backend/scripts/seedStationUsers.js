// Backward-compatible entry point; no longer creates station-specific accounts.
const { setupAccounts } = require('./setupAccounts');
const db = require('../config/db');
if (require.main === module) setupAccounts().then(() => console.log('Configured admin and user accounts.'))
  .catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.pool.end());
module.exports = { setupAccounts };
