// Families share a letter on their visits, apart from the queue number (utils/family.js,
// routes/family.js), and members waiting at the same station move on together
// (utils/familyMoves.js). The route tests use real PostgreSQL temp tables: run with RUN_DB_TESTS=1
// and a configured apps/backend/.env.
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

  test('the next family takes the first unused letter of the day', () => {
    expect(nextFamilyLetters([])).toBe('A');
    expect(nextFamilyLetters(['A', null])).toBe('B');
    expect(nextFamilyLetters(['B', 'C'])).toBe('A');
  });
});

const USER_ID = 2;
const DAY = '2026-11-05';

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('families against PostgreSQL temporary tables', () => {
  let client, app, previousSecret;
  const secret = 'family-test';
  const auth = (req) => req.set('Authorization', `Bearer ${jwt.sign({ id: USER_ID, role: 'user' }, secret)}`);
  const post = (url, body) => auth(request(app).post(url)).send(body);
  const join = (visit_id, with_visit_id) => post('/api/family', { visit_id, with_visit_id });
  const done = (visitId, station) => post(`/api/queue/${visitId}/stations/${station}/complete`, {});
  const visits = async () => Object.fromEntries((await client.query('SELECT id, queue_no, family FROM visits ORDER BY id')).rows
    .map(r => [r.id, `${r.queue_no}${r.family ? ` ${r.family}` : ''}`]));
  // Where each open visit is waiting now.
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
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, english_name TEXT, khmer_name TEXT, sex TEXT, date_of_birth DATE);
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT, location_id INT, queue_no TEXT, visit_date DATE,
        family TEXT CHECK (family ~ '^[A-Z]{1,3}$'), completed_at TIMESTAMP, last_updated_by INT REFERENCES users(id),
        last_updated_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW());
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

  // The Tan family registered as 3, 4 and 5; 6 is someone else; 7 is at another location; 8 another
  // day. Everyone waits at Triage, then goes to Consult.
  beforeEach(() => client.query(`
    TRUNCATE visit_station_route_history, visit_stations, visits, patients, users RESTART IDENTITY CASCADE;
    INSERT INTO users VALUES (1), (${USER_ID});
    INSERT INTO patients (id, english_name) VALUES (1, 'Mother Tan'), (2, 'Father Tan'), (3, 'Child Tan'), (4, 'Sok'), (5, 'Dara'), (6, 'Vanna');
    INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES
      (3, 1, 1, '3', '${DAY}', 1), (4, 2, 1, '4', '${DAY}', 1), (5, 3, 1, '5', '${DAY}', 1),
      (6, 4, 1, '6', '${DAY}', 1), (7, 5, 2, '1', '${DAY}', 1), (8, 6, 1, '3', '2026-11-04', 1);
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
    test('the Tan family 3, 4 and 5 share family A; their queue numbers stay', async () => {
      const first = await join(4, 3);
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ family: 'A', visits: [{ visit_id: 4, queue_no: '4', family: 'A' }, { visit_id: 3, queue_no: '3', family: 'A' }] });
      expect((await join(5, 4)).body.family).toBe('A');
      expect(await visits()).toMatchObject({ 3: '3 A', 4: '4 A', 5: '5 A', 6: '6' });
      const { rows } = await client.query('SELECT last_updated_by FROM visits WHERE id IN (3, 4, 5)');
      expect(rows.every(row => row.last_updated_by === USER_ID)).toBe(true);
    });

    test('the next family gets the next letter; another location or day starts again at A', async () => {
      await join(4, 3);
      await client.query(`INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES
        (9, 6, 1, '9', '${DAY}', 1), (10, 5, 2, '2', '${DAY}', 1), (11, 6, 1, '4', '2026-11-04', 1)`);
      expect((await join(9, 6)).body.family).toBe('B');
      expect((await join(10, 7)).body.family).toBe('A');
      expect((await join(11, 8)).body.family).toBe('A');
    });

    test('a patient can join any family, whichever member is picked, or move to another; leaving keeps the number', async () => {
      await join(4, 3);
      await join(6, 5);
      // 5 picks a member of family A; family B is left with 6 alone.
      expect((await join(5, 3)).body.visits[0]).toEqual({ visit_id: 5, queue_no: '5', family: 'A' });
      // A patient with no family picked by one with a family joins that family.
      await client.query(`INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES (9, 6, 1, '9', '${DAY}', 1)`);
      expect((await join(4, 9)).body.family).toBe('A');
      expect(await visits()).toMatchObject({ 3: '3 A', 4: '4 A', 5: '5 A', 6: '6 B', 9: '9 A' });
      const left = await post('/api/family/leave', { visit_id: 4 });
      expect(left.body).toEqual({ visit_id: 4, queue_no: '4', family: null });
      expect(await visits()).toMatchObject({ 3: '3 A', 4: '4', 5: '5 A' });
      expect((await post('/api/family/leave', { visit_id: 4 })).status).toBe(200);
    });

    test('patients at another location or on another day, or the same patient, are refused', async () => {
      expect((await join(3, 7)).status).toBe(400);
      expect((await join(3, 8)).status).toBe(400);
      expect((await join(3, 3)).status).toBe(400);
      expect((await join(3, 99)).status).toBe(404);
      expect((await post('/api/family/leave', { visit_id: 99 })).status).toBe(404);
      expect(await visits()).toMatchObject({ 3: '3', 7: '1', 8: '3' });
    });
  });

  describe('moving together', () => {
    beforeEach(async () => { await join(4, 3); });

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

    test('a member at another station does not hold the family', async () => {
      await join(5, 3);
      await done(5, 'triage'); // waits for 3 and 4
      await client.query("UPDATE visit_stations SET completed_at = NOW() WHERE visit_id = 5 AND station = 'triage'");
      await done(3, 'triage');
      expect((await done(4, 'triage')).body.family_moved.map(m => m.visit_id)).toEqual([3]);
    });

    test('leaving the family, being discharged or being sent elsewhere lets the waiting members go', async () => {
      await done(3, 'triage');
      await post('/api/family/leave', { visit_id: 4 });
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'triage' });

      await join(4, 3); // both at different stations now
      await join(5, 3);
      await done(4, 'triage'); // waits for 5
      await post('/api/queue/5/complete', {});
      expect(await stations()).toMatchObject({ 4: 'consultation', 5: 'finished' });

      await client.query(`INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES (9, 6, 1, '9', '${DAY}', 1);
        INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by) VALUES (9, 'triage', 1, NOW(), 1), (9, 'dental', 2, NULL, 1);`);
      await join(6, 3);
      await join(9, 3);
      await done(6, 'triage'); // waits for 9
      await auth(request(app).put('/api/queue/9/stations')).send({ stations: ['dental'] });
      expect(await stations()).toMatchObject({ 6: 'consultation', 9: 'dental' });
    });

    test('a member done at a station who leaves the family moves on', async () => {
      await done(3, 'triage');
      await post('/api/family/leave', { visit_id: 3 });
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'triage' });
    });
  });
});
