// Separate development and clinic (production) settings: config/env.js and scripts/setupEnv.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { envMode, loadEnv } = require('../config/env');
const { setupEnv } = require('../scripts/setupEnv');

const KEYS = ['NODE_ENV', 'VEASNA_TEST_SHARED', 'VEASNA_TEST_ADDRESS', 'VEASNA_TEST_NAME'];
let saved, dir;
beforeEach(() => {
  saved = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veasna-env-'));
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
const write = (name, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), text);
};

describe('backend env files', () => {
  beforeEach(() => {
    write('.env', 'VEASNA_TEST_SHARED=db\nVEASNA_TEST_ADDRESS=from-env\nNODE_ENV=production\n');
    write('.env.development', 'VEASNA_TEST_ADDRESS=localhost\nVEASNA_TEST_NAME=\n');
    write('.env.production', 'VEASNA_TEST_ADDRESS=lan\nVEASNA_TEST_NAME=veasna\n');
  });

  test('npm start (production) is the only mode that is not development', () => {
    expect(envMode('production')).toBe('production');
    for (const value of [undefined, '', 'development', 'test']) expect(envMode(value)).toBe('development');
  });

  test('npm run dev reads .env.development, then the shared .env; a NODE_ENV line in .env is ignored', () => {
    expect(loadEnv({ dir })).toEqual({ mode: 'development', files: ['.env.development', '.env'] });
    expect(process.env).toMatchObject({ NODE_ENV: 'development', VEASNA_TEST_ADDRESS: 'localhost', VEASNA_TEST_SHARED: 'db' });
    // An empty value in the mode file still wins, e.g. MDNS_NAME= turns the name off.
    expect(process.env.VEASNA_TEST_NAME).toBe('');
  });

  test('npm start reads .env.production, then the shared .env', () => {
    process.env.NODE_ENV = 'production';
    expect(loadEnv({ dir })).toEqual({ mode: 'production', files: ['.env.production', '.env'] });
    expect(process.env).toMatchObject({ VEASNA_TEST_ADDRESS: 'lan', VEASNA_TEST_NAME: 'veasna', VEASNA_TEST_SHARED: 'db' });
  });

  test('a value set in the shell wins over the files', () => {
    process.env.VEASNA_TEST_ADDRESS = 'shell';
    loadEnv({ dir });
    expect(process.env.VEASNA_TEST_ADDRESS).toBe('shell');
  });

  test('an installation with only .env works as before', () => {
    fs.rmSync(path.join(dir, '.env.development'));
    expect(loadEnv({ dir }).files).toEqual(['.env']);
    expect(process.env.VEASNA_TEST_ADDRESS).toBe('from-env');
  });
});

describe('npm run setup:env', () => {
  const templates = {
    'apps/backend/.env.example': 'shared', 'apps/backend/.env.development.example': 'backend dev',
    'apps/backend/.env.production.example': 'backend prod', 'apps/frontend/.env.development.example': 'web dev',
    'apps/frontend/.env.production.example': 'web prod',
  };
  beforeEach(() => { for (const [name, text] of Object.entries(templates)) write(name, text); });
  const read = name => fs.readFileSync(path.join(dir, name), 'utf8');

  test('creates every missing file from its template', () => {
    const result = setupEnv(dir);
    expect(result.created).toEqual(['apps/backend/.env', 'apps/backend/.env.development', 'apps/backend/.env.production',
      'apps/frontend/.env.development', 'apps/frontend/.env.production']);
    expect(result.warnings).toEqual([]);
    expect(read('apps/frontend/.env.production')).toBe('web prod');
  });

  test('never changes an existing file', () => {
    write('apps/backend/.env', 'DB_PASSWORD=secret');
    const result = setupEnv(dir);
    expect(result.kept).toEqual(['apps/backend/.env']);
    expect(read('apps/backend/.env')).toBe('DB_PASSWORD=secret');
  });

  test('warns when .env.local would override both web app modes', () => {
    write('apps/frontend/.env.local', '# notes\nNEXT_PUBLIC_BACKEND_URL=http://localhost:3000\n');
    expect(setupEnv(dir).warnings).toEqual([expect.stringMatching(/\.env\.local sets NEXT_PUBLIC_BACKEND_URL/)]);
    write('apps/frontend/.env.local', '# NEXT_PUBLIC_BACKEND_URL=http://localhost:3000\n');
    expect(setupEnv(dir).warnings).toEqual([]);
  });
});
