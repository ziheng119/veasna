// Patient Details: a patient's visit list and one visit's complete record (routes/patient.js), and
// which accounts may open them (utils/dayScope.js). Uses only connection-local temporary tables
// (RUN_DB_TESTS=1 and a configured apps/backend/.env); clinic data is never modified.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');
const { currentVisitDate } = require('../utils/queueNumber');

const TABLES = ['users', 'patients', 'visits', 'visit_stations', 'tb_screening', 'vitals', 'hef',
  'visual_acuity', 'presenting_complaint', 'history', 'seva', 'dental', 'physiotherapy', 'consultation',
  'painpoints', 'referral', 'pharmacy', 'prescriptions'];

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Patient Details records', () => {
  let client, app, previousSecret;
  const today = currentVisitDate();
  const secret = 'patient-record-test';
  const as = (id, role, url) => request(app).get(url).set('Authorization', `Bearer ${jwt.sign({ id, role }, secret)}`);

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    // Temporary tables first; sex_type comes from the clinic schema when it exists.
    await client.query('SET search_path TO pg_temp, public');
    const setup = fs.readFileSync(path.join(__dirname, '../db_setup.sql'), 'utf8').replace(/\r\n/g, '\n');
    const hasSexType = (await client.query("SELECT 1 FROM pg_type WHERE typname = 'sex_type'")).rows.length > 0;
    for (const table of TABLES) {
      const start = setup.indexOf(`CREATE TABLE ${table} (`);
      let sql = setup.slice(start, setup.indexOf('\n);', start) + 3).replace('CREATE TABLE', 'CREATE TEMP TABLE');
      if (!hasSexType) sql = sql.replace(/sex_type/g, 'TEXT');
      await client.query(sql);
    }
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS screening_date DATE;
      INSERT INTO users (id, username, role, is_active, screening_date) VALUES
        (1, 'admin', 'admin', TRUE, NULL), (2, 'dayaccount', 'user', TRUE, '${today}'), (3, 'plainuser', 'user', TRUE, NULL);
      INSERT INTO patients (id, english_name, family, last_updated_by) VALUES
        (1, 'Returning Patient', 'A', 1), (2, 'Only Earlier', NULL, 1);
      INSERT INTO visits (id, patient_id, queue_no, visit_date, completed_at, last_updated_by, created_at) VALUES
        (10, 1, '4', '2025-06-01', '2025-06-01 15:00', 1, '2025-06-01 08:00'),
        (11, 1, '7', '${today}', NULL, 1, NOW()),
        (20, 2, '2', '2025-06-01', '2025-06-01 15:00', 1, '2025-06-01 08:00');
      INSERT INTO visit_stations (visit_id, station, position, entered_at, completed_at, last_updated_by) VALUES
        (10, 'triage', 1, '2025-06-01 08:00', '2025-06-01 09:00', 1),
        (10, 'consultation', 2, '2025-06-01 09:00', '2025-06-01 10:00', 1),
        (10, 'pharmacy', 3, '2025-06-01 10:00', '2025-06-01 11:00', 1);
      INSERT INTO visual_acuity (visit_id, left_without_pinhole, last_updated_by) VALUES (10, '20/40', 1);
      INSERT INTO dental (visit_id, notes, referral_needed, last_updated_by) VALUES (10, 'Extraction', TRUE, 1);
      INSERT INTO consultation (visit_id, notes, prescription, require_referral, last_updated_by) VALUES (10, 'Seen', '', TRUE, 1);
      INSERT INTO referral (visit_id, referral_type, illness, duration, reason, doctor_name, last_updated_by) VALUES
        (10, 'Optician', '', '', 'Glasses', 'Dr Ellie Choi', 1);
      INSERT INTO pharmacy (id, drug_name, stock_count, last_updated_by) VALUES (1, 'Paracetamol', 10, 1);
      INSERT INTO prescriptions (visit_id, drug_id, drug_name, quantity, instructions, status, prescribed_by, prescribed_at, dispensed_by, dispensed_at, last_updated_by) VALUES
        (10, 1, 'Paracetamol', 6, '1 tablet twice a day', 'dispensed', 1, '2025-06-01 10:00', 1, '2025-06-01 10:30', 1);
      INSERT INTO prescriptions (visit_id, drug_id, drug_name, quantity, status, prescribed_by, prescribed_at, cancelled_by, cancelled_at, last_updated_by) VALUES
        (10, 1, 'Ibuprofen', 2, 'cancelled', 1, '2025-06-01 10:05', 1, '2025-06-01 10:10', 1);
    `);
    db.query.mockImplementation((...args) => client.query(...args));
    app = express(); app.use(express.json());
    app.use(require('../middleware/authorizeApi').authorizeApi);
    app.use('/patient', require('../routes/patient'));
  });
  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  });

  test('a Patient Details edit from a page opened before another device saved is refused (409)', async () => {
    const put = (body) => request(app).put('/patient/2').set('Authorization', `Bearer ${jwt.sign({ id: 1, role: 'admin' }, secret)}`)
      .send({ english_name: 'Only Earlier', date_of_birth: '1990-01-01', sex: 'F', ...body });
    const opened = (await as(1, 'admin', '/patient/2')).body.patient.last_updated_at;
    expect((await put({ address: 'Other device', expected_updated_at: opened })).status).toBe(200);
    const stale = await put({ address: 'Stale', expected_updated_at: opened });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatch(/Cancel to see the saved details/);
    const current = (await as(1, 'admin', '/patient/2')).body.patient;
    expect(current.address).toBe('Other device');
    expect((await put({ address: 'Mine', expected_updated_at: current.last_updated_at })).status).toBe(200);
    expect((await put({ address: 'Older app' })).status).toBe(200);
  });

  test('a visit shows its prescriptions, stations, and every station record', async () => {
    const { status, body } = await as(1, 'admin', '/patient/visit/10');
    expect(status).toBe(200);
    expect(body.prescriptions).toEqual([
      expect.objectContaining({ drug_name: 'Paracetamol', quantity: 6, instructions: '1 tablet twice a day', status: 'dispensed', prescribed_by: 'admin', dispensed_by: 'admin' }),
      expect.objectContaining({ drug_name: 'Ibuprofen', status: 'cancelled', cancelled_by: 'admin' }),
    ]);
    expect(body.stations.map(s => [s.station, s.completed_at !== null])).toEqual([['triage', true], ['consultation', true], ['pharmacy', true]]);
    expect(body.dental).toMatchObject({ notes: 'Extraction', referral_needed: true });
    expect(body.referrals[0]).toMatchObject({ doctor_name: 'Dr Ellie Choi' });
    expect(body.completed_at).toBeTruthy();
  });

  test('the visit list marks what each visit has, and the patient shows their family', async () => {
    const { body } = await as(1, 'admin', '/patient/1');
    expect(body.patient.family).toBe('A');
    const earlier = body.visits.find(v => v.visit_id === 10);
    expect(earlier).toMatchObject({ has_triage: true, has_dental: true, has_consultation: true, has_referral: true,
      prescription_count: 1, has_tb_flag: false, has_vitals: false, has_physiotherapy: false });
    expect(earlier.completed_at).toBeTruthy();
    expect(body.visits.find(v => v.visit_id === 11)).toMatchObject({ has_triage: false, prescription_count: 0, completed_at: null });
  });

  test("non-admin accounts open only today's patients, with their earlier visits", async () => {
    for (const [id, role] of [[2, 'user'], [3, 'user']]) {
      expect((await as(id, role, '/patient/1')).status).toBe(200);
      expect((await as(id, role, '/patient/visit/10')).status).toBe(200); // the returning patient's history
      expect((await as(id, role, '/patient/2')).status).toBe(404); // not queued today
      expect((await as(id, role, '/patient/visit/20')).status).toBe(404);
    }
    expect((await as(1, 'admin', '/patient/2')).status).toBe(200);
  });

  test("only the admin may change earlier visits; other accounts change only today's", async () => {
    const editable = async (id, role) => Object.fromEntries((await as(id, role, '/patient/1')).body.visits
      .map(v => [v.visit_id, v.editable]));
    expect(await editable(1, 'admin')).toEqual({ 10: true, 11: true });
    expect(await editable(2, 'user')).toEqual({ 10: false, 11: true });
    expect(await editable(3, 'user')).toEqual({ 10: false, 11: true });
    // The flag matches what the server enforces on save (checkDayScope).
    const put = (id, role, url) => request(app).put(url).set('Authorization', `Bearer ${jwt.sign({ id, role }, secret)}`).send({});
    expect((await put(2, 'user', '/visits/10/vitals')).status).toBe(403);
    expect((await put(3, 'user', '/visits/10')).status).toBe(403);
  });
});
