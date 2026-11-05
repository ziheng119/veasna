// Families: patients who come together share a letter (patients.family; utils/family.js,
// routes/family.js), apart from their queue numbers, and members waiting at the same station move on
// together (utils/familyMoves.js). The route tests use real PostgreSQL temp tables: run with
// RUN_DB_TESTS=1 and a configured apps/backend/.env.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const path = require('path');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');
const { familyLetters, nextFamilyLetters } = require('../utils/family');

describe('family letters', () => {
  test('go A to Z, then AA, AB', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(familyLetters)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });

  test('the next family takes the first free letter, so freed letters are used again', () => {
    expect(nextFamilyLetters([])).toBe('A');
    expect(nextFamilyLetters(['A', null])).toBe('B');
    expect(nextFamilyLetters(['A', 'C'])).toBe('B');
  });
});

const USER_ID = 2;
const DAY = '2026-11-05';

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('families against PostgreSQL temporary tables', () => {
  let client, app, previousSecret;
  const secret = 'family-test';
  const auth = (req) => req.set('Authorization', `Bearer ${jwt.sign({ id: USER_ID, role: 'user' }, secret)}`);
  const post = (url, body) => auth(request(app).post(url)).send(body);
  const join = (patient_id, with_patient_id) => post('/api/family', { patient_id, with_patient_id });
  const leave = (patient_id) => post('/api/family/leave', { patient_id });
  const done = (visitId, station) => post(`/api/queue/${visitId}/stations/${station}/complete`, {});
  const families = async () => Object.fromEntries((await client.query('SELECT id, family FROM patients ORDER BY id')).rows
    .map(r => [r.id, r.family]));
  // Where each visit is waiting now.
  const stations = async () => Object.fromEntries((await client.query(`
    SELECT v.id, CASE WHEN v.completed_at IS NOT NULL THEN 'finished' ELSE (SELECT s.station FROM visit_stations s
      WHERE s.visit_id = v.id AND s.completed_at IS NULL ORDER BY s.position LIMIT 1) END AS station FROM visits v ORDER BY v.id`)).rows.map(r => [r.id, r.station]));

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    client = new Client({
      host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000,
    });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id INT PRIMARY KEY);
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, location_id INT, english_name TEXT, khmer_name TEXT, sex TEXT, date_of_birth DATE,
        family TEXT CHECK (family ~ '^[A-Z]{1,4}$'), last_updated_by INT REFERENCES users(id), last_updated_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT REFERENCES patients(id), location_id INT, queue_no TEXT, visit_date DATE,
        completed_at TIMESTAMP, last_updated_by INT REFERENCES users(id), last_updated_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE visit_stations (id SERIAL PRIMARY KEY, visit_id INT REFERENCES visits(id), station TEXT, position INT,
        entered_at TIMESTAMP, completed_at TIMESTAMP, family_ready_at TIMESTAMP, last_updated_by INT,
        last_updated_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW(), UNIQUE (visit_id, station));
      CREATE TEMP TABLE visit_station_route_history (id SERIAL PRIMARY KEY, visit_id INT, previous_stations JSONB,
        requested_stations JSONB, last_updated_by INT, created_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE tb_screening (visit_id INT PRIMARY KEY, status TEXT);
      CREATE TEMP TABLE visual_acuity (visit_id INT); CREATE TEMP TABLE presenting_complaint (visit_id INT);
      CREATE TEMP TABLE history (visit_id INT); CREATE TEMP TABLE consultation (visit_id INT);
      CREATE TEMP TABLE physiotherapy (visit_id INT); CREATE TEMP TABLE dental (visit_id INT);
      CREATE TEMP TABLE seva (visit_id INT); CREATE TEMP TABLE prescriptions (visit_id INT, status TEXT);`);
    db.query.mockImplementation((...args) => client.query(...args));
    db.pool.connect.mockImplementation(async () => ({ query: (...args) => client.query(...args), release() {} }));
    app = express();
    app.use(express.json());
    app.use('/api/family', require('../routes/family'));
    app.use('/api/queue', require('../routes/queue'));
  });

  // Patients 1-3 are the Tan family, 4 is Sok, 5 is Dara (another location) and 6 is Vanna, who has
  // no visit today. Visits 3, 4, 5 and 6 (patients 1-4) wait at Triage, then go to Consult.
  beforeEach(() => client.query(`
    TRUNCATE visit_station_route_history, visit_stations, visits, patients, users RESTART IDENTITY CASCADE;
    INSERT INTO users VALUES (1), (${USER_ID});
    INSERT INTO patients (id, location_id, english_name, last_updated_by) VALUES
      (1, 1, 'Mother Tan', 1), (2, 1, 'Father Tan', 1), (3, 1, 'Child Tan', 1), (4, 1, 'Sok', 1), (5, 2, 'Dara', 1), (6, 1, 'Vanna', 1);
    INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES
      (3, 1, 1, '3', '${DAY}', 1), (4, 2, 1, '4', '${DAY}', 1), (5, 3, 1, '5', '${DAY}', 1), (6, 4, 1, '6', '${DAY}', 1);
    INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
      SELECT id, 'triage', 1, NOW(), 1 FROM visits;
    INSERT INTO visit_stations (visit_id, station, position, last_updated_by)
      SELECT id, 'consultation', 2, 1 FROM visits;`));

  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  describe('grouping', () => {
    test('picking another patient starts a family of the two; others join by picking any member', async () => {
      const first = await join(2, 1);
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ family: 'A', patients: [{ patient_id: 2, family: 'A' }, { patient_id: 1, family: 'A' }] });
      expect((await join(3, 2)).body.family).toBe('A');
      expect(await families()).toMatchObject({ 1: 'A', 2: 'A', 3: 'A', 4: null });
      const { rows } = await client.query('SELECT last_updated_by FROM patients WHERE id IN (1, 2, 3)');
      expect(rows.every(row => row.last_updated_by === USER_ID)).toBe(true);
      // Queue numbers don't change.
      expect((await client.query('SELECT queue_no FROM visits ORDER BY id')).rows.map(r => r.queue_no)).toEqual(['3', '4', '5', '6']);
    });

    test('patients who are not in today\'s queue can be grouped too', async () => {
      expect((await join(6, 4)).body.family).toBe('A');
      expect(await families()).toMatchObject({ 4: 'A', 6: 'A' });
    });

    test('a family left with one member is dissolved, and its letter is used again', async () => {
      await join(2, 1); // A
      await join(4, 3); // B
      await join(6, 1); // A: 1, 2, 6
      expect(await families()).toMatchObject({ 1: 'A', 2: 'A', 3: 'B', 4: 'B', 6: 'A' });
      // 4 leaves B: 3 is left alone, so B is no longer a family.
      expect((await leave(4)).body).toEqual({ patient_id: 4, family: null });
      expect(await families()).toMatchObject({ 3: null, 4: null });
      // The next family takes the freed B, while A is untouched.
      expect((await join(4, 3)).body.family).toBe('B');
      // Moving to another family leaves the old one behind: 6 joins B, A still has 1 and 2.
      await join(6, 3);
      expect(await families()).toMatchObject({ 1: 'A', 2: 'A', 3: 'B', 4: 'B', 6: 'B' });
      // 1 leaves A for B: A (just 2) is dissolved.
      await join(1, 4);
      expect(await families()).toMatchObject({ 1: 'B', 2: null });
      expect((await leave(2)).status).toBe(200);
      expect((await join(1, 4)).body.family).toBe('B');
    });

    test('patients at another location, or the same patient, are refused', async () => {
      expect((await join(1, 5)).status).toBe(400);
      expect((await join(1, 1)).status).toBe(400);
      expect((await join(1, 99)).status).toBe(404);
      expect((await leave(99)).status).toBe(404);
      expect(await families()).toMatchObject({ 1: null, 5: null });
    });
  });

  describe('moving together', () => {
    beforeEach(async () => { await join(2, 1); });

    test('a member who is done waits for the rest of the family at the station; then they all move on', async () => {
      const first = await done(3, 'triage');
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ held: true, next_station: null, waiting_for: [{ visit_id: 4, queue_no: '4', english_name: 'Father Tan' }] });
      expect(await stations()).toMatchObject({ 3: 'triage', 4: 'triage' });
      // The queue shows who is waiting for family; others are not held (6 has no family).
      const queue = await auth(request(app).get('/api/queue').query({ location_id: 1, date: DAY, station: 'triage' }));
      expect(queue.body.filter(p => p.family_waiting).map(p => p.visit_id)).toEqual([3]);
      expect(queue.body.find(p => p.visit_id === 4)).toMatchObject({ family: 'A', family_waiting: false });
      expect((await done(6, 'triage')).body).toMatchObject({ held: false, next_station: 'consultation' });

      const second = await done(4, 'triage');
      expect(second.body).toMatchObject({ held: false, next_station: 'consultation',
        family_moved: [{ visit_id: 3, completed_station: 'triage', next_station: 'consultation' }] });
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'consultation', 6: 'consultation' });
      // Done again at Consult: the wait starts afresh there.
      expect((await done(4, 'consultation')).body.held).toBe(true);
    });

    test('a member at another station, or on another day, does not hold the family', async () => {
      await join(3, 1);
      await client.query("UPDATE visit_stations SET completed_at = NOW() WHERE visit_id = 5 AND station = 'triage'");
      await client.query(`INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES (9, 2, 1, '1', '2026-11-04', 1);
        INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by) VALUES (9, 'triage', 1, NOW(), 1);`);
      await done(3, 'triage');
      expect((await done(4, 'triage')).body.family_moved.map(m => m.visit_id)).toEqual([3]);
    });

    test('leaving, being discharged or being sent elsewhere lets the waiting members go', async () => {
      await done(3, 'triage'); // 1 waits for 2
      await join(4, 1); // Sok (visit 6) joins: A is 1, 2, 4
      await leave(2);
      expect(await stations()).toMatchObject({ 3: 'triage', 4: 'triage' }); // still waits for Sok

      await post('/api/queue/6/complete', {});
      expect(await stations()).toMatchObject({ 3: 'consultation', 6: 'finished' });

      await join(3, 1); // the child joins A (1 at Consult, 3 at Triage)
      await join(2, 3); // and the father: 2 and 3 wait at Triage
      await done(5, 'triage'); // the child waits for the father
      await auth(request(app).put('/api/queue/4/stations')).send({ stations: ['consultation'] });
      expect(await stations()).toMatchObject({ 4: 'consultation', 5: 'consultation' });
    });

    test('a member waiting for family whose family is dissolved moves on', async () => {
      await done(3, 'triage'); // 1 waits for 2
      await leave(2); // A had two members: dissolved
      expect(await families()).toMatchObject({ 1: null, 2: null });
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'triage' });
    });
  });
});
