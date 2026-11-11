// Database backups with pg_dump, so a lost or broken host laptop doesn't lose the clinic's records.
// "npm run backup" takes one now; "npm start" also takes one at start-up and every
// BACKUP_INTERVAL_HOURS while it runs. Each is a complete copy in pg_dump's custom format, restored
// with pg_restore (see the backend README). The newest BACKUP_KEEP files are kept.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.join(__dirname, '..', '..', '..', 'backups');
const NAME = /^veasna-\d{4}-\d{2}-\d{2}_\d{6}\.dump$/;

const settings = (env = process.env) => ({
  dir: env.BACKUP_DIR || DEFAULT_DIR,
  keep: Math.max(1, Number(env.BACKUP_KEEP) || 30),
  intervalHours: env.BACKUP_INTERVAL_HOURS === undefined ? 2 : Number(env.BACKUP_INTERVAL_HOURS),
});

// veasna-2026-11-11_143005.dump, in the host's local time; names sort oldest first.
function backupFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `veasna-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.dump`;
}

// pg_dump from PG_BIN, else the newest PostgreSQL install on Windows (where it isn't on the PATH
// by default), else the PATH. It must be at least the database server's version.
function findPgDump(env = process.env, platform = process.platform) {
  const exe = platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
  if (env.PG_BIN) return path.join(env.PG_BIN, exe);
  if (platform === 'win32') {
    const root = path.join(env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
    const versions = fs.existsSync(root) ? fs.readdirSync(root).filter((name) => /^\d+(\.\d+)?$/.test(name)) : [];
    versions.sort((a, b) => Number(b) - Number(a));
    const found = versions.map((version) => path.join(root, version, 'bin', exe)).find((file) => fs.existsSync(file));
    if (found) return found;
  }
  return exe;
}

// Deletes all but the newest `keep` backups in `dir`; other files there are left alone.
function pruneBackups(dir, keep) {
  const old = fs.readdirSync(dir).filter((name) => NAME.test(name)).sort().slice(0, -keep);
  for (const name of old) fs.rmSync(path.join(dir, name));
  return old;
}

// Takes a backup now and resolves with its path. Written under a temporary name first, so a
// backup cut short (power loss, full disk) is never left looking complete.
async function runBackup(env = process.env) {
  const { dir, keep } = settings(env);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, backupFileName());
  const partial = `${file}.partial`;
  const args = ['--format=custom', `--file=${partial}`, '--host', env.DB_HOST || 'localhost',
    '--port', String(env.DB_PORT || 5432), '--username', env.DB_USER, env.DB_NAME];
  try {
    await new Promise((resolve, reject) => {
      execFile(findPgDump(env), args, { env: { ...process.env, PGPASSWORD: env.DB_PASSWORD || '' } }, (error, _out, stderr) => {
        if (!error) return resolve();
        reject(new Error(error.code === 'ENOENT'
          ? 'pg_dump was not found. Set PG_BIN in apps/backend/.env to the PostgreSQL bin folder.'
          : (stderr || error.message).trim()));
      });
    });
    fs.renameSync(partial, file);
  } finally {
    fs.rmSync(partial, { force: true });
  }
  pruneBackups(dir, keep);
  return file;
}

// Backs up now and every BACKUP_INTERVAL_HOURS (0 turns this off). Failures are logged and the
// next one is still tried: a backup problem must never stop the clinic's server.
function scheduleBackups(env = process.env, log = console) {
  const { intervalHours } = settings(env);
  if (!(intervalHours > 0)) return null;
  const backUp = () => runBackup(env)
    .then((file) => log.log(`Backup saved: ${file}`))
    .catch((error) => log.error(`Backup failed: ${error.message}`));
  backUp();
  const timer = setInterval(backUp, intervalHours * 60 * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { backupFileName, findPgDump, pruneBackups, runBackup, scheduleBackups };
