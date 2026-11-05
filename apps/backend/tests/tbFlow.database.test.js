// Suspected-TB flow (routes/tb.js, utils/tb.js) against real PostgreSQL temp tables: flagging or
// clearing sends the patient to Consultation, and anyone may clear a flag.
// Run with RUN_DB_TESTS=1 and a configured apps/backend/.env. No clinic tables are touched.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');

const ADMIN_ID = 1;
const USER_ID = 2;
// The fewest red flags that flag a patient (TB_MIN_RED_FLAGS).
const THREE_FLAGS = ['cough_2_weeks', 'fever', 'night_sweats'];

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Suspected TB flow', () => {
  let client, app, previousSecret;
  const secret = 'tb-flow-test';
  const flag = (body, role = 'user') => request(app).post('/api/tb/1/flag')
    .set('Authorization', `Bearer ${jwt.sign({ id: role === 'admin' ? ADMIN_ID : USER_ID, role }, secret)}`)
    .send(body);
  const route = async () => (await client.query(
    'SELECT station, entered_at IS NOT NULL AS entered, completed_at IS NOT NULL AS completed FROM visit_stations WHERE visit_id = 1 ORDER BY completed_at IS NULL, position'
  )).rows;
  const pending = async () => (await route()).filter(s => !s.completed).map(s => s.station);
  const history = async () => (await client.query('SELECT requested_stations, last_updated_by FROM visit_station_route_history')).rows;
  // Gives visit 1 its stations, and optionally a TB flag or a discharge.
  const setRoute = (rows, { flagged = false, completed = false } = {}) => client.query(`
    UPDATE visits SET completed_at = ${completed ? 'NOW()' : 'NULL'} WHERE id = 1;
    INSERT INTO visit_stations (visit_id, station, position, entered_at, completed_at, last_updated_by) VALUES ${rows};
    ${flagged ? `INSERT INTO tb_screening (visit_id, red_flags, status, flagged_by, last_updated_by) VALUES (1, '{fever}', 'suspected', ${USER_ID}, ${USER_ID});` : ''}`);
  const WAITING_AT_TRIAGE = `(1,'triage',1,NOW(),NULL,${USER_ID}), (1,'seva',2,NULL,NULL,${USER_ID}), (1,'consultation',3,NULL,NULL,${USER_ID})`;

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    client = new Client({
      host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000,
    });
    await client.connect();
    await client.query('SET search_path TO pg_temp; CREATE TEMP TABLE users (id INT PRIMARY KEY);');
    // Real table definitions, so constraints match production.
    const setup = fs.readFileSync(path.join(__dirname, '../db_setup.sql'), 'utf8').replace(/\r\n/g, '\n');
    for (const table of ['visits', 'visit_stations', 'tb_screening']) {
      const start = setup.indexOf(`CREATE TABLE ${table} (`);
      let sql = setup.slice(start, setup.indexOf('\n);', start) + 3);
      // Visits reference patients and locations, which these tests do not need.
      if (table === 'visits') sql = sql.replace(/REFERENCES (patients|locations)\(id\)\s+ON DELETE \w+( NULL)? ON UPDATE CASCADE/g, '');
      await client.query(sql.replace('CREATE TABLE', 'CREATE TEMP TABLE'));
    }
    const history = fs.readFileSync(path.join(__dirname, '../migrations/010_station_route_history.sql'), 'utf8');
    await client.query(history.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'));
    db.query.mockImplementation((...args) => client.query(...args));
    db.pool.connect.mockImplementation(async () => ({ query: (...args) => client.query(...args), release() {} }));
    app = express();
    app.use(express.json());
    app.use('/api/tb', require('../routes/tb'));
  });

  beforeEach(() => client.query(`
    TRUNCATE visit_station_route_history, tb_screening, visit_stations, visits, users RESTART IDENTITY CASCADE;
    INSERT INTO users VALUES (${ADMIN_ID}), (${USER_ID});
    INSERT INTO visits (patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES (1, 1, '7', CURRENT_DATE, ${USER_ID});`));

  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  test('flagging at Triage sends the patient straight to Consultation; other stations stay queued', async () => {
    await setRoute(WAITING_AT_TRIAGE);
    const res = await flag({ flagged: true, red_flags: THREE_FLAGS });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ flagged: true, status: 'suspected', current_station: 'consultation' });
    expect(await route()).toEqual([
      { station: 'consultation', entered: true, completed: false },
      { station: 'triage', entered: false, completed: false },
      { station: 'seva', entered: false, completed: false },
    ]);
    expect(await history()).toEqual([{ requested_stations: ['consultation', 'triage', 'seva'], last_updated_by: USER_ID }]);
  });

  test('any user can clear the flag; the patient stays at Consultation', async () => {
    await setRoute(`(1,'triage',1,NOW(),NOW(),${USER_ID}), (1,'consultation',2,NOW(),NULL,${USER_ID})`, { flagged: true });
    const res = await flag({ flagged: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ flagged: false, status: 'cleared', current_station: 'consultation' });
    const { rows } = await client.query('SELECT status, reviewed_by, last_updated_by FROM tb_screening');
    expect(rows).toEqual([{ status: 'cleared', reviewed_by: USER_ID, last_updated_by: USER_ID }]);
    expect(await history()).toEqual([]);
  });

  test('clearing a patient still waiting elsewhere (flagged before this change) sends them to Consultation', async () => {
    await setRoute(WAITING_AT_TRIAGE, { flagged: true });
    const res = await flag({ flagged: false });
    expect(res.body).toMatchObject({ flagged: false, current_station: 'consultation' });
    expect(await pending()).toEqual(['consultation', 'triage', 'seva']);
  });

  test('Consultation is added when the route does not include it', async () => {
    await setRoute(`(1,'triage',1,NOW(),NULL,${USER_ID}), (1,'physiotherapy',2,NULL,NULL,${USER_ID})`);
    expect((await flag({ flagged: true, red_flags: THREE_FLAGS })).body.current_station).toBe('consultation');
    expect(await pending()).toEqual(['consultation', 'triage', 'physiotherapy']);
  });

  test('a finished Consultation is not reopened', async () => {
    await setRoute(`(1,'consultation',1,NOW(),NOW(),${USER_ID}), (1,'physiotherapy',2,NOW(),NULL,${USER_ID})`, { flagged: true });
    expect((await flag({ flagged: false })).body).toMatchObject({ flagged: false, current_station: 'physiotherapy' });
    expect(await history()).toEqual([]);
  });

  test('a discharged visit can be cleared without changing its route', async () => {
    await setRoute(WAITING_AT_TRIAGE, { flagged: true, completed: true });
    expect((await flag({ flagged: false })).body).toMatchObject({ flagged: false, current_station: null });
    expect(await pending()).toEqual(['triage', 'seva', 'consultation']);
  });

  test('clearing a flag someone already cleared changes nothing', async () => {
    await setRoute(WAITING_AT_TRIAGE, { flagged: true });
    await flag({ flagged: false }, 'admin');
    const res = await flag({ flagged: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ visit_id: 1, status: 'cleared', flagged: false });
    expect((await client.query('SELECT reviewed_by FROM tb_screening')).rows[0].reviewed_by).toBe(ADMIN_ID);
    expect(await history()).toHaveLength(1);
  });

  test('fewer than 3 red flags do not flag the patient, and nothing changes', async () => {
    await setRoute(WAITING_AT_TRIAGE);
    const res = await flag({ flagged: true, red_flags: ['fever', 'night_sweats'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/3 or more red flags/);
    expect((await client.query('SELECT 1 FROM tb_screening')).rows).toHaveLength(0);
    expect(await pending()).toEqual(['triage', 'seva', 'consultation']);
  });

  test('a user flag is saved with its red flags; bad input and missing visits are refused', async () => {
    await setRoute(WAITING_AT_TRIAGE);
    expect((await flag({ flagged: true, red_flags: THREE_FLAGS })).body).toMatchObject({ flagged: true, red_flags: THREE_FLAGS });
    expect((await flag({ flagged: 'yes' })).status).toBe(400);
    expect((await flag({ flagged: true, red_flags: 'fever' })).status).toBe(400);
    const missing = await request(app).post('/api/tb/2/flag')
      .set('Authorization', `Bearer ${jwt.sign({ id: ADMIN_ID, role: 'admin' }, secret)}`).send({ flagged: true, red_flags: THREE_FLAGS });
    expect(missing.status).toBe(404);
  });

  test('users still cannot edit an existing flag; an admin edit leaves the route alone', async () => {
    await setRoute(WAITING_AT_TRIAGE, { flagged: true });
    const before = (await client.query('SELECT * FROM tb_screening')).rows;
    expect((await flag({ flagged: true, red_flags: ['night_sweats', 'fever', 'weight_loss'] })).status).toBe(403);
    expect((await client.query('SELECT * FROM tb_screening')).rows).toEqual(before);
    const res = await flag({ flagged: true, red_flags: ['night_sweats', 'fever', 'weight_loss'] }, 'admin');
    expect(res.status).toBe(200);
    expect(res.body.current_station).toBeUndefined();
    expect(await pending()).toEqual(['triage', 'seva', 'consultation']);
  });
});
