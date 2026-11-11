// npm run backup                     saves a copy of the database now, in BACKUP_DIR (default backups/)
// npm run backup -- E:\veasna-backups  saves it in that folder instead, e.g. a USB stick
require('../config/env').loadEnv();
const path = require('path');
const { runBackup } = require('../utils/backup');

// Relative to where the command was typed (npm runs this from apps/backend).
const folder = process.argv[2] && path.resolve(process.env.INIT_CWD || process.cwd(), process.argv[2]);
runBackup(folder ? { ...process.env, BACKUP_DIR: folder } : process.env)
  .then((file) => console.log(`Backup saved: ${file}`))
  .catch((error) => {
    console.error(`Backup failed: ${error.message}`);
    process.exit(1);
  });
