// Database backups with pg_dump, so a lost or broken host laptop doesn't lose the clinic's records.
// - "npm run backup" takes one now (optionally into another folder, e.g. a USB stick);
// - "npm start" also takes one at start-up and every BACKUP_INTERVAL_HOURS while it runs;
// - "npm run restore" puts one back into a new database and switches the server to it, or with
//   --check only proves that it restores (scripts/restore.js).
// Each is a complete copy in pg_dump's custom format. The newest BACKUP_KEEP files are kept.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DEFAULT_DIR = path.join(__dirname, '..', '..', '..', 'backups');
const NAME = /^veasna-\d{4}-\d{2}-\d{2}_\d{6}\.dump$/;
// Counted after a restore, to show the copy holds the clinic's records.
const COUNTED_TABLES = ['patients', 'visits', 'users'];

const settings = (env = process.env) => ({
  dir: env.BACKUP_DIR || DEFAULT_DIR,
  keep: Math.max(1, Number(env.BACKUP_KEEP) || 30),
  intervalHours: env.BACKUP_INTERVAL_HOURS === undefined ? 2 : Number(env.BACKUP_INTERVAL_HOURS),
});

const pad = (value) => String(value).padStart(2, '0');
const stamp = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
  `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

// veasna-2026-11-11_143005.dump, in the host's local time; names sort oldest first.
const backupFileName = (date = new Date()) => `veasna-${stamp(date)}.dump`;

// A PostgreSQL program (pg_dump, pg_restore, createdb, dropdb) from PG_BIN, else the newest
// PostgreSQL install on Windows (where they aren't on the PATH by default), else the PATH.
// pg_dump must be at least the database server's version.
function findPgTool(name, env = process.env, platform = process.platform) {
  const exe = platform === 'win32' ? `${name}.exe` : name;
  if (env.PG_BIN) return path.join(env.PG_BIN, exe);
  if (platform === 'win32') {
    const root = path.join(env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
    const versions = fs.existsSync(root) ? fs.readdirSync(root).filter((version) => /^\d+(\.\d+)?$/.test(version)) : [];
    versions.sort((a, b) => Number(b) - Number(a));
    const found = versions.map((version) => path.join(root, version, 'bin', exe)).find((file) => fs.existsSync(file));
    if (found) return found;
  }
  return exe;
}

// Runs a PostgreSQL program with the database settings from .env.
function runPgTool(name, args, env) {
  const connection = ['--host', env.DB_HOST || 'localhost', '--port', String(env.DB_PORT || 5432), '--username', env.DB_USER];
  return new Promise((resolve, reject) => {
    execFile(findPgTool(name, env), [...connection, ...args], { env: { ...process.env, PGPASSWORD: env.DB_PASSWORD || '' } }, (error, _out, stderr) => {
      if (!error) return resolve();
      reject(new Error(error.code === 'ENOENT'
        ? `${name} was not found. Set PG_BIN in apps/backend/.env to the PostgreSQL bin folder.`
        : (stderr || error.message).trim()));
    });
  });
}

// The backups in `dir`, newest first.
function listBackups(dir = settings().dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => NAME.test(name)).sort().reverse().map((name) => path.join(dir, name));
}

// Deletes all but the newest `keep` backups in `dir`; other files there are left alone.
function pruneBackups(dir, keep) {
  const old = fs.readdirSync(dir).filter((name) => NAME.test(name)).sort().slice(0, -keep);
  for (const name of old) fs.rmSync(path.join(dir, name));
  return old;
}

// The latest scheduled backup under npm start, for /health: when it was taken (or failed) and why.
let lastBackup = null;
const backupStatus = () => lastBackup;

// Takes a backup now and resolves with its path. Written under a temporary name first, so a
// backup cut short (power loss, full disk, USB stick pulled out) is never left looking complete.
async function runBackup(env = process.env) {
  const { dir, keep } = settings(env);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, backupFileName());
  const partial = `${file}.partial`;
  try {
    await runPgTool('pg_dump', ['--format=custom', `--file=${partial}`, env.DB_NAME], env);
    fs.renameSync(partial, file);
  } finally {
    fs.rmSync(partial, { force: true });
  }
  pruneBackups(dir, keep);
  return file;
}

// How many patients, visits and accounts database `name` holds.
async function countRecords(name, env = process.env) {
  const client = new Client({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: name });
  await client.connect();
  try {
    const counts = {};
    for (const table of COUNTED_TABLES) counts[table] = Number((await client.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count);
    return counts;
  } finally {
    await client.end();
  }
}

// Restores `file` into a new, empty database and resolves with { database, counts }. The current
// database is never touched. With `check`, the new database is dropped again afterwards: the
// backup is proven to restore. A restore that fails part-way leaves no database behind.
async function restoreBackup(file, env = process.env, { check = false, now = new Date() } = {}) {
  if (!fs.existsSync(file)) throw new Error(`No backup at ${file}.`);
  const database = `veasna_restored_${stamp(now).replace(/-/g, '')}`;
  await runPgTool('createdb', [database], env);
  let keep = false;
  try {
    await runPgTool('pg_restore', ['--no-owner', '--exit-on-error', `--dbname=${database}`, file], env);
    const counts = await countRecords(database, env);
    keep = !check;
    return { database, counts };
  } finally {
    if (!keep) await runPgTool('dropdb', [database], env).catch(() => {});
  }
}

// Points apps/backend/.env at database `name` (DB_NAME); returns the name it used before.
function useDatabase(name, envFile) {
  const text = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const previous = (text.match(/^DB_NAME=(.*)$/m) || [])[1]?.trim() ?? null;
  const updated = previous === null ? `${text.replace(/\n?$/, '\n')}DB_NAME=${name}\n` : text.replace(/^DB_NAME=.*$/m, `DB_NAME=${name}`);
  fs.writeFileSync(envFile, updated);
  return previous;
}

// Backs up now and every BACKUP_INTERVAL_HOURS (0 turns this off). Failures are logged and the
// next one is still tried: a backup problem must never stop the clinic's server.
function scheduleBackups(env = process.env, log = console) {
  const { intervalHours } = settings(env);
  if (!(intervalHours > 0)) return null;
  const backUp = () => runBackup(env)
    .then((file) => {
      lastBackup = { at: new Date().toISOString(), file };
      log.log(`Backup saved: ${file}`);
    })
    .catch((error) => {
      lastBackup = { ...lastBackup, failed_at: new Date().toISOString(), error: error.message };
      log.error(`Backup failed: ${error.message}`);
    });
  backUp();
  const timer = setInterval(backUp, intervalHours * 60 * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = {
  backupFileName, backupStatus, countRecords, findPgTool, listBackups, pruneBackups, restoreBackup,
  runBackup, scheduleBackups, useDatabase,
};
