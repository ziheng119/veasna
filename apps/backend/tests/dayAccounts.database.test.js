// Screening-day accounts (utils/dayScope.js), the Accounts API (routes/accounts.js) and editable
// form options (routes/formOptions.js), against temporary tables only.
const express = require('express');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
jest.mock('../config/db', () => ({
  query: jest.fn(), pool: { connect: jest.fn() },
  hashPassword: password => require('bcrypt').hash(password, 4),
  comparePassword: (password, hash) => require('bcrypt').compare(password, hash),
}));
const db = require('../config/db');
const { localDate } = require('../utils/validation');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Screening-day accounts', () => {
  let client, app, previousSecret;
  const today = localDate();
  const tokens = {};
  const as = (name, method, url) => request(app)[method](url).set('Authorization', 'Bearer ' + tokens[name]);

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'day-accounts-test';
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    const hash = await db.hashPassword('pw-1234');
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id SERIAL PRIMARY KEY, username TEXT, password_hash TEXT, role TEXT DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW());
      CREATE UNIQUE INDEX test_username ON users (LOWER(username));
      CREATE TEMP TABLE locations (id INT PRIMARY KEY, name TEXT);
      INSERT INTO locations VALUES (1, 'Village');
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, location_id INT, english_name TEXT, khmer_name TEXT, face_id TEXT,
        date_of_birth DATE, sex TEXT, address TEXT, phone_number TEXT, family TEXT);
      INSERT INTO patients (id, location_id, english_name) VALUES (1, 1, 'Alice Returning'), (2, 1, 'Bob Earlier');
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT, location_id INT, visit_date DATE, completed_at TIMESTAMP);
      INSERT INTO visits VALUES (10, 1, 1, '2025-01-01', NOW()), (11, 1, 1, '${today}', NULL), (20, 2, 1, '2025-01-01', NOW());
      CREATE TEMP TABLE visit_stations (visit_id INT, station TEXT, position INT, completed_at TIMESTAMP);
      CREATE TEMP TABLE audit (author INT REFERENCES users(id));`);
    await client.query(fs.readFileSync(path.join(__dirname, '../migrations/020_day_accounts_form_options.sql'), 'utf8'));
    await client.query(`INSERT INTO users (username, password_hash, role, screening_date) VALUES
      ('admin', $1, 'admin', NULL), ('user', $1, 'user', NULL), ('today_village', $1, 'user', $2), ('jan_village', $1, 'user', '2025-01-01')`,
      [hash, today]);
    db.query.mockImplementation((...args) => client.query(...args));
    db.pool.connect.mockResolvedValue({ query: (...args) => client.query(...args), release() {} });
    app = express(); app.use(express.json());
    app.use(require('../middleware/authorizeApi').authorizeApi);
    app.use('/auth', require('../routes/session'));
    app.use('/patients', require('../routes/patients'));
    app.use('/accounts', require('../routes/accounts'));
    app.use('/form-options', require('../routes/formOptions'));
    // Everything else only checks the gate in front of it.
    app.all('*', (_req, res) => res.sendStatus(200));
    for (const name of ['admin', 'user', 'today_village', 'jan_village']) {
      const login = await request(app).post('/auth/login').send({ username: name, password: 'pw-1234' });
      expect(login.status).toBe(200);
      tokens[name] = login.body.token;
    }
  });
  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  });

  test('a day account lists only patients queued on its day; the user account sees everyone', async () => {
    expect((await as('today_village', 'get', '/auth/me')).body.screening_date).toBe(today);
    expect((await as('today_village', 'get', '/patients?location_id=1')).body.map(p => p.id)).toEqual([1]);
    expect((await as('user', 'get', '/patients?location_id=1')).body.map(p => p.id).sort()).toEqual([1, 2]);
    expect((await as('today_village', 'get', '/patients/search?q=e')).body.map(p => p.id)).toEqual([1]);
  });

  test("a day account opens that day's patients and their earlier visits, nobody else's", async () => {
    expect((await as('today_village', 'get', '/patient/1')).status).toBe(200);
    expect((await as('today_village', 'get', '/patient/visit/10')).status).toBe(200); // Alice's history
    expect((await as('today_village', 'get', '/patient/2')).status).toBe(404);
    expect((await as('today_village', 'get', '/patient/visit/20')).status).toBe(404);
    expect((await as('today_village', 'get', '/visits/vitals/2/20')).status).toBe(404);
    expect((await as('today_village', 'get', '/patients/2/history')).status).toBe(403); // unknown to the scope: refused
    expect((await as('user', 'get', '/patient/2')).status).toBe(200);
  });

  test('a returning patient can be found by name to be queued, with identifying details only', async () => {
    const found = (await as('today_village', 'get', '/patients/lookup?location_id=1&q=Bob')).body;
    expect(found.map(p => p.id)).toEqual([2]);
    expect(Object.keys(found[0]).sort()).toEqual(['address', 'date_of_birth', 'english_name', 'face_id', 'family', 'id', 'khmer_name', 'location_id', 'phone_number', 'sex']);
    expect((await as('today_village', 'get', '/patients/lookup?location_id=1&q=Bo')).body).toEqual([]);
  });

  test("a day account saves only to its day's visits, and only on that day", async () => {
    expect((await as('today_village', 'post', '/visits/dental/11')).status).toBe(200);
    expect((await as('today_village', 'post', '/visits/dental/10')).status).toBe(403); // Alice's earlier visit
    expect((await as('today_village', 'post', '/family').send({ patient_id: 1, with_patient_id: 2 })).status).toBe(403);
    expect((await as('today_village', 'post', '/registration')).status).toBe(200);
    const late = await as('jan_village', 'post', '/registration');
    expect(late.status).toBe(403);
    expect(late.body.message).toContain('2025-01-01');
    expect((await as('jan_village', 'get', '/patients?location_id=1')).body.map(p => p.id).sort()).toEqual([1, 2]);
  });

  test('analytics, bulk referrals, downloads and accounts are for admins only', async () => {
    for (const name of ['user', 'today_village']) {
      for (const url of ['/analytics', '/visits/referrals', '/export/patients', '/accounts']) {
        expect((await as(name, 'get', url)).status).toBe(403);
      }
    }
    expect((await as('admin', 'get', '/export/patients')).status).toBe(200);
  });

  test('an admin creates, changes and removes screening-day accounts', async () => {
    const created = await as('admin', 'post', '/accounts').send({ username: 'dec13village', password: 'ilovebtb', screening_date: '2026-12-13' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ username: 'dec13village', role: 'user', screening_date: '2026-12-13', is_active: true });
    expect((await as('admin', 'post', '/accounts').send({ username: 'DEC13village', password: 'ilovebtb', screening_date: '2026-12-13' })).status).toBe(409);
    expect((await as('admin', 'post', '/accounts').send({ username: 'bad name', password: 'ilovebtb', screening_date: '2026-12-13' })).status).toBe(400);
    expect((await as('user', 'post', '/accounts').send({ username: 'sneaky', password: 'ilovebtb', screening_date: '2026-12-13' })).status).toBe(403);

    const login = await request(app).post('/auth/login').send({ username: 'dec13village', password: 'ilovebtb' });
    expect(login.body.user.screening_date).toBe('2026-12-13');

    const id = created.body.id;
    expect((await as('admin', 'put', `/accounts/${id}`).send({ screening_date: '2026-12-14' })).body.screening_date).toBe('2026-12-14');
    expect((await as('admin', 'put', `/accounts/${id}`).send({ is_active: false })).body.is_active).toBe(false);
    expect((await request(app).post('/auth/login').send({ username: 'dec13village', password: 'ilovebtb' })).status).toBe(403);

    // The fixed accounts are not changed here.
    const adminId = (await client.query("SELECT id FROM users WHERE username='admin'")).rows[0].id;
    expect((await as('admin', 'put', `/accounts/${adminId}`).send({ is_active: false })).status).toBe(404);

    expect((await as('admin', 'delete', `/accounts/${id}`)).body).toEqual({ id, deleted: true });
    const usedId = (await client.query("SELECT id FROM users WHERE username='today_village'")).rows[0].id;
    await client.query('INSERT INTO audit VALUES ($1)', [usedId]);
    expect((await as('admin', 'delete', `/accounts/${usedId}`)).body).toEqual({ id: usedId, deleted: false, disabled: true });
    expect((await client.query('SELECT is_active FROM users WHERE id=$1', [usedId])).rows[0].is_active).toBe(false);
  });

  test('admins change form choices; everyone reads them; built-in choices can be restored', async () => {
    const before = (await as('user', 'get', '/form-options')).body;
    expect(before.snellen.customized).toBe(false);
    expect(before.snellen.items[0]).toEqual({ id: '20/20', label: '20/20' });
    expect(before.sticker_colours.items.find(item => item.id === 'light_blue')).toEqual({ id: 'light_blue', label: 'Light blue', colour: '#8ccbf2' });
    expect((await as('user', 'put', '/form-options/snellen').send({ items: [{ id: '6/6', label: '6/6' }] })).status).toBe(403);
    expect((await as('admin', 'put', '/form-options/snellen').send({ items: [{ label: 'six' }] })).status).toBe(400);
    expect((await as('admin', 'put', '/form-options/snellen').send({ items: [{ label: '6/6' }, { label: '6 / 6' }] })).status).toBe(400);
    expect((await as('admin', 'put', '/form-options/nope').send({ items: [{ label: 'x' }] })).status).toBe(404);
    const saved = await as('admin', 'put', '/form-options/snellen').send({ items: [{ label: '6 / 7.5' }, { label: '6/6' }] });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ customized: true, last_updated_by: 'admin', items: [{ id: '6/7.5', label: '6/7.5' }, { id: '6/6', label: '6/6' }] });
    const conditions = await as('admin', 'put', '/form-options/consultation_conditions')
      .send({ items: [{ id: 'diabetes', label: 'Diabetes (type 1 or 2)' }, { id: 'kidney', label: 'Kidney disease' }] });
    expect(conditions.status).toBe(200);
    expect((await as('admin', 'put', '/form-options/consultation_conditions').send({ items: [{ id: 'Bad Id', label: 'X' }] })).status).toBe(400);
    expect(await require('../utils/consultationConditions').validConditions(['kidney'])).toBe(true);
    expect(await require('../utils/consultationConditions').validConditions(['hypertension'])).toBe(false);
    expect((await as('admin', 'delete', '/form-options/snellen')).body.customized).toBe(false);
  });
});
