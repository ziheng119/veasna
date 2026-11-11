jest.mock('child_process', () => ({ execFile: jest.fn() }));
// The restored copy's record counts.
jest.mock('pg', () => ({ Client: jest.fn(() => ({
  connect: jest.fn(), end: jest.fn(),
  query: jest.fn(async (sql) => ({ rows: [{ count: { patients: '20', visits: '30', users: '11' }[sql.split(' ').pop()] }] })),
})) }));

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { backupFileName, backupStatus, findPgTool, listBackups, pruneBackups, restoreBackup, runBackup, scheduleBackups, useDatabase } = require('../utils/backup');

let dir;
const env = (extra = {}) => ({ BACKUP_DIR: dir, PG_BIN: '/pg/bin', DB_USER: 'app', DB_NAME: 'veasna', DB_PASSWORD: 'secret', ...extra });
// pg_dump writes the file named by --file, then answers.
const pgDumpWrites = () => execFile.mockImplementation((_cmd, args, _opts, done) => {
  fs.writeFileSync(args.find((arg) => arg.startsWith('--file=')).slice(7), 'dump');
  done(null, '', '');
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veasna-backup-'));
  execFile.mockReset();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test('names backups by local date and time, so they sort oldest first', () => {
  expect(backupFileName(new Date(2026, 0, 5, 9, 3, 7))).toBe('veasna-2026-01-05_090307.dump');
});

test('finds pg_dump in PG_BIN, else the newest Windows install, else the PATH', () => {
  expect(findPgTool('pg_dump', { PG_BIN: '/opt/pg' }, 'linux')).toBe(path.join('/opt/pg', 'pg_dump'));
  for (const version of ['9.6', '16', '18']) {
    fs.mkdirSync(path.join(dir, 'PostgreSQL', version, 'bin'), { recursive: true });
    if (version !== '18') fs.writeFileSync(path.join(dir, 'PostgreSQL', version, 'bin', 'pg_dump.exe'), '');
  }
  // 18 has no pg_dump (a client-less install), so 16 is used.
  expect(findPgTool('pg_dump', { ProgramFiles: dir }, 'win32')).toBe(path.join(dir, 'PostgreSQL', '16', 'bin', 'pg_dump.exe'));
  expect(findPgTool('pg_dump', {}, 'linux')).toBe('pg_dump');
});

test('keeps only the newest backups and leaves other files alone', () => {
  const names = ['veasna-2026-01-01_080000.dump', 'veasna-2026-01-02_080000.dump', 'veasna-2026-01-03_080000.dump', 'notes.txt'];
  for (const name of names) fs.writeFileSync(path.join(dir, name), '');
  expect(pruneBackups(dir, 2)).toEqual(['veasna-2026-01-01_080000.dump']);
  expect(fs.readdirSync(dir).sort()).toEqual(names.slice(1).sort());
});

test('runs pg_dump with the database settings and saves the finished file', async () => {
  pgDumpWrites();
  const file = await runBackup(env());
  const [cmd, args, opts] = execFile.mock.calls[0];
  expect(cmd).toBe(path.join('/pg/bin', process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump'));
  expect(args).toEqual(expect.arrayContaining(['--format=custom', '--username', 'app', 'veasna']));
  expect(opts.env.PGPASSWORD).toBe('secret');
  expect(fs.readdirSync(dir)).toEqual([path.basename(file)]);
});

test('a failed backup leaves no file and says why', async () => {
  execFile.mockImplementation((_cmd, args, _opts, done) => {
    fs.writeFileSync(args.find((arg) => arg.startsWith('--file=')).slice(7), 'half');
    done(new Error('exit 1'), '', 'pg_dump: error: connection refused\n');
  });
  await expect(runBackup(env())).rejects.toThrow('pg_dump: error: connection refused');
  expect(fs.readdirSync(dir)).toEqual([]);

  execFile.mockImplementation((_cmd, _args, _opts, done) => done(Object.assign(new Error('spawn'), { code: 'ENOENT' })));
  await expect(runBackup(env())).rejects.toThrow('Set PG_BIN');
});

test('the schedule backs up at once, logs failures, and can be turned off', async () => {
  expect(scheduleBackups(env({ BACKUP_INTERVAL_HOURS: '0' }))).toBeNull();
  expect(execFile).not.toHaveBeenCalled();

  execFile.mockImplementation((_cmd, _args, _opts, done) => done(new Error('exit 1'), '', 'disk full'));
  const log = { log: jest.fn(), error: jest.fn() };
  const timer = scheduleBackups(env(), log);
  clearInterval(timer);
  await new Promise((resolve) => setImmediate(resolve));
  expect(log.error).toHaveBeenCalledWith('Backup failed: disk full');
});

// The PostgreSQL program each call ran, and its last argument.
const ran = () => execFile.mock.calls.map(([cmd, args]) => `${path.basename(cmd).replace('.exe', '')} ${args.at(-1)}`);

test('lists backups newest first, ignoring other files', () => {
  for (const name of ['veasna-2026-01-01_080000.dump', 'veasna-2026-01-02_080000.dump', 'notes.txt']) fs.writeFileSync(path.join(dir, name), '');
  expect(listBackups(dir).map((file) => path.basename(file))).toEqual(['veasna-2026-01-02_080000.dump', 'veasna-2026-01-01_080000.dump']);
  expect(listBackups(path.join(dir, 'missing'))).toEqual([]);
});

test('a restore goes into a new database and counts its records; --check drops it again', async () => {
  execFile.mockImplementation((_cmd, _args, _opts, done) => done(null, '', ''));
  const file = path.join(dir, 'veasna-2026-01-02_080000.dump');
  fs.writeFileSync(file, 'dump');
  const now = new Date(2026, 0, 2, 9, 30, 0);
  expect(await restoreBackup(file, env(), { now })).toEqual({
    database: 'veasna_restored_20260102_093000', counts: { patients: 20, visits: 30, users: 11 },
  });
  expect(ran()).toEqual(['createdb veasna_restored_20260102_093000', `pg_restore ${file}`]);

  execFile.mockClear();
  await restoreBackup(file, env(), { now, check: true });
  expect(ran()).toEqual(['createdb veasna_restored_20260102_093000', `pg_restore ${file}`, 'dropdb veasna_restored_20260102_093000']);
});

test('a restore that fails part-way leaves no new database, and a missing file is reported', async () => {
  execFile.mockImplementation((cmd, _args, _opts, done) => (cmd.includes('pg_restore') ? done(new Error('exit 1'), '', 'pg_restore: error: bad file') : done(null, '', '')));
  const file = path.join(dir, 'broken.dump');
  fs.writeFileSync(file, 'not a dump');
  await expect(restoreBackup(file, env())).rejects.toThrow('pg_restore: error: bad file');
  expect(ran().at(-1)).toMatch(/^dropdb veasna_restored_/);
  await expect(restoreBackup(path.join(dir, 'none.dump'), env())).rejects.toThrow('No backup at');
});

test('switching database changes only DB_NAME in .env, and says what it was', () => {
  const envFile = path.join(dir, '.env');
  fs.writeFileSync(envFile, 'DB_USER=app\nDB_NAME=veasna_screening\nPORT=3000\n');
  expect(useDatabase('veasna_restored_1', envFile)).toBe('veasna_screening');
  expect(fs.readFileSync(envFile, 'utf8')).toBe('DB_USER=app\nDB_NAME=veasna_restored_1\nPORT=3000\n');
  fs.writeFileSync(envFile, 'DB_USER=app');
  expect(useDatabase('veasna_restored_2', envFile)).toBeNull();
  expect(fs.readFileSync(envFile, 'utf8')).toBe('DB_USER=app\nDB_NAME=veasna_restored_2\n');
});

test('/health can tell when the last automatic backup was taken, or why it failed', async () => {
  pgDumpWrites();
  const log = { log: jest.fn(), error: jest.fn() };
  clearInterval(scheduleBackups(env(), log));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(backupStatus()).toMatchObject({ file: expect.stringMatching(/veasna-.*\.dump$/) });
  expect(backupStatus().error).toBeUndefined();

  execFile.mockImplementation((_cmd, _args, _opts, done) => done(new Error('exit 1'), '', 'disk full'));
  clearInterval(scheduleBackups(env(), log));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(backupStatus()).toMatchObject({ file: expect.any(String), error: 'disk full' });
});
