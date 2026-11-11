// npm run backup: saves a copy of the database now (utils/backup.js).
require('../config/env').loadEnv();
const { runBackup } = require('../utils/backup');

runBackup()
  .then((file) => console.log(`Backup saved: ${file}`))
  .catch((error) => {
    console.error(`Backup failed: ${error.message}`);
    process.exit(1);
  });
