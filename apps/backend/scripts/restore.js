// npm run restore                         lists the backups
// npm run restore -- latest --check       proves the newest backup restores, changing nothing
// npm run restore -- latest               restores it into a new database and switches to it
// npm run restore -- <file> [--check]     the same for one backup file (e.g. from a USB stick)
// Restoring never touches the current database: it backs that up first, restores into a new
// database, and points DB_NAME in apps/backend/.env at it. Restart the server afterwards.
require('../config/env').loadEnv();
const path = require('path');
const { listBackups, restoreBackup, runBackup, useDatabase } = require('../utils/backup');

const ENV_FILE = path.join(__dirname, '..', '.env');
const args = process.argv.slice(2);
const check = args.includes('--check');
const choice = args.find((arg) => !arg.startsWith('--'));

const describe = (counts) => `${counts.patients} patients, ${counts.visits} visits, ${counts.users} accounts`;

async function main() {
  const backups = listBackups();
  if (!choice) {
    if (!backups.length) return console.log('No backups yet. Run "npm run backup" to take one.');
    console.log('Backups, newest first:');
    for (const file of backups) console.log(`  ${file}`);
    console.log('\nCheck the newest:   npm run restore -- latest --check');
    console.log('Restore the newest: npm run restore -- latest');
    return;
  }
  // Relative to where the command was typed (npm runs this from apps/backend).
  const file = choice === 'latest' ? backups[0] : path.resolve(process.env.INIT_CWD || process.cwd(), choice);
  if (!file) throw new Error('No backups yet, so there is nothing to restore.');

  if (check) {
    const { counts } = await restoreBackup(file, process.env, { check: true });
    return console.log(`Backup OK: ${path.basename(file)} restores with ${describe(counts)}. Nothing was changed.`);
  }

  // A copy of the current records first, in case this restore was a mistake.
  await runBackup()
    .then((saved) => console.log(`Current database backed up first: ${saved}`))
    .catch((error) => console.warn(`Couldn't back up the current database first (${error.message}). Continuing.`));
  const { database, counts } = await restoreBackup(file);
  const previous = useDatabase(database, ENV_FILE);
  console.log(`Restored ${path.basename(file)} into database "${database}": ${describe(counts)}.`);
  console.log('apps/backend/.env now uses it. Restart the server (stop npm start with Ctrl+C, then npm start).');
  if (previous) console.log(`To go back, set DB_NAME=${previous} in apps/backend/.env and restart. "${previous}" was not changed.`);
}

main().catch((error) => {
  console.error(`Restore failed: ${error.message}`);
  process.exit(1);
});
