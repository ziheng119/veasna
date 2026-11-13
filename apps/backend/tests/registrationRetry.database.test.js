// Registrations that are safe to send again (routes/visits.js, migration 024): a request repeated
// with the same request_id is saved once, and a returning patient already in today's queue is not
// queued a second time. Also the NSSF answers registration saves beside the patient. Real PostgreSQL temp tables: run with RUN_DB_TESTS=1 and
// apps/backend/.env.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');
const { localDate } = require('../utils/validation');

const VITALS = { height: 160, weight: 50, bmi: 19.5, bp_systolic: 110, bp_diastolic: 70, temperature: 37, below_3rd_percentile: false };

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('registering again after a lost answer', () => {
  const secret = 'registration-retry-test';
  let client, app, previousSecret;
  const today = localDate();
  const register = (patientInfo, extra = {}) => request(app).post('/api/visits')
    .set('Authorization', `Bearer ${jwt.sign({ id: 1, role: 'user' }, secret)}`)
    .send({ patientInfo, vitals: VITALS, hef: {}, ...extra });
  const count = async table => Number((await client.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count);

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id INT PRIMARY KEY);
      INSERT INTO users VALUES (1);
      CREATE TEMP TABLE patients (id SERIAL PRIMARY KEY, english_name TEXT, khmer_name TEXT, date_of_birth DATE,
        sex TEXT, address TEXT, phone_number TEXT, family TEXT, last_updated_by INT REFERENCES users(id),
        last_updated_at TIMESTAMP DEFAULT NOW());
      INSERT INTO patients (id, english_name, sex, last_updated_by) VALUES (500, 'Returning Rith', 'M', 1);
      CREATE TEMP TABLE visits (id SERIAL PRIMARY KEY, patient_id INT REFERENCES patients(id), queue_no TEXT,
        visit_date DATE, sticker_colour TEXT, completed_at TIMESTAMP, last_updated_by INT, created_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE visit_stations (id SERIAL PRIMARY KEY, visit_id INT, station TEXT, position INT, entered_at TIMESTAMP,
        completed_at TIMESTAMP, family_ready_at TIMESTAMP, last_updated_by INT, last_updated_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE tb_screening (visit_id INT PRIMARY KEY, status TEXT);
      CREATE TEMP TABLE vitals (visit_id INT, height NUMERIC, weight NUMERIC, bmi NUMERIC, below_3rd_percentile BOOLEAN,
        bp_systolic INT, bp_diastolic INT, temperature NUMERIC, notes TEXT, last_updated_by INT);
      CREATE TEMP TABLE hef (visit_id INT, know_of_hef BOOLEAN, has_hef BOOLEAN, notes TEXT, last_updated_by INT);`);
    // The NSSF columns come from their migration, run twice to show it is safe to repeat.
    await client.query(fs.readFileSync(path.join(__dirname, '../migrations/029_nssf.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(__dirname, '../migrations/029_nssf.sql'), 'utf8'));
    // The migration itself, so the column and unique index are the ones the host gets.
    await client.query(fs.readFileSync(path.join(__dirname, '../migrations/024_registration_request_id.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(__dirname, '../migrations/024_registration_request_id.sql'), 'utf8'));
    db.query.mockImplementation((...args) => client.query(...args));
    db.pool.connect.mockResolvedValue({ query: (...args) => client.query(...args), release() {} });
    app = express(); app.use(express.json());
    app.use('/api/visits', require('../routes/visits'));
  });
  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  });

  test('a new patient sent twice with one request id is registered once, with the same number', async () => {
    const first = await register({ english_name: 'Sokha New', sex: 'F', age: '30' }, { request_id: 'reg-0001-abcd' });
    expect(first.status).toBe(201);
    const again = await register({ english_name: 'Sokha New', sex: 'F', age: '30' }, { request_id: 'reg-0001-abcd' });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ repeated: true, visit_id: first.body.visit_id, patient_id: first.body.patient_id,
      queue_no: first.body.queue_no, current_station: 'triage', english_name: 'Sokha New', sex: 'F', age: '30' });
    expect(await count("patients WHERE english_name = 'Sokha New'")).toBe(1);
    expect(await count('visits')).toBe(1);
    expect(await count('vitals')).toBe(1);
  });

  test('a different request id registers a different patient, and without one it still works', async () => {
    const other = await register({ english_name: 'Dara Other', sex: 'M' }, { request_id: 'reg-0002-abcd' });
    const none = await register({ english_name: 'Vanna NoId', sex: 'F' });
    expect([other.status, none.status]).toEqual([201, 201]);
    expect(new Set([other.body.queue_no, none.body.queue_no]).size).toBe(2);
  });

  test("a returning patient already in today's queue is refused with their number; once finished they can return", async () => {
    const first = await register({ id: 500 }, { request_id: 'reg-0500-first' });
    expect(first.status).toBe(201);
    const twice = await register({ id: 500 }, { request_id: 'reg-0500-other-desk' });
    expect(twice.status).toBe(409);
    expect(twice.body).toMatchObject({ visit_id: first.body.visit_id, queue_no: first.body.queue_no });
    expect(twice.body.error).toBe(`This patient is already in today's queue as number ${first.body.queue_no}.`);
    // The same request sent again is still answered with the first registration, not refused.
    expect((await register({ id: 500 }, { request_id: 'reg-0500-first' })).status).toBe(200);
    await client.query('UPDATE visits SET completed_at = NOW() WHERE id = $1', [first.body.visit_id]);
    expect((await register({ id: 500 }, { request_id: 'reg-0500-later' })).status).toBe(201);
    // An open visit from an earlier day doesn't block today's.
    await client.query(`UPDATE visits SET visit_date = DATE '${today}' - 1 WHERE patient_id = 500 AND completed_at IS NULL`);
    expect((await register({ id: 500 })).status).toBe(201);
  });

  test('a malformed request id is refused before anything is saved', async () => {
    const before = await count('visits');
    for (const request_id of ['short', 'has spaces in it', 42, 'x'.repeat(65)]) {
      const res = await register({ english_name: 'Bad Id', sex: 'F' }, { request_id });
      expect(res.status).toBe(400);
    }
    expect(await count('visits')).toBe(before);
  });

  describe('NSSF answers', () => {
    const answers = async visitId => (await client.query(
      'SELECT has_nssf, uses_hef_nssf FROM hef WHERE visit_id = $1', [visitId])).rows[0];

    test('yes and no are saved; left out (an older app) they are saved as not asked', async () => {
      const asked = await register({ english_name: 'Nssf Yes', sex: 'F' }, { hef: { has_nssf: 'yes', uses_hef_nssf: 'no' } });
      expect(await answers(asked.body.visit_id)).toEqual({ has_nssf: true, uses_hef_nssf: false });
      const older = await register({ english_name: 'Nssf Old', sex: 'F' });
      expect(await answers(older.body.visit_id)).toEqual({ has_nssf: null, uses_hef_nssf: null });
    });

    test('any other answer is refused', async () => {
      const res = await register({ english_name: 'Nssf Bad', sex: 'F' }, { hef: { has_nssf: true } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("hef.has_nssf must be 'yes' or 'no'.");
    });
  });

});
