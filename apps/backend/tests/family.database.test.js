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
  const group = (patient_ids) => post('/api/family/group', { patient_ids });
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
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, english_name TEXT, khmer_name TEXT, sex TEXT, date_of_birth DATE,
        family TEXT CHECK (family ~ '^[A-Z]{1,4}$'), last_updated_by INT REFERENCES users(id), last_updated_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT REFERENCES patients(id) ON DELETE CASCADE, queue_no TEXT, visit_date DATE,
        completed_at TIMESTAMP, last_updated_by INT REFERENCES users(id), last_updated_at TIMESTAMP DEFAULT NOW(), sticker_colour TEXT, created_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE visit_stations (id SERIAL PRIMARY KEY, visit_id INT REFERENCES visits(id) ON DELETE CASCADE, station TEXT, position INT,
        entered_at TIMESTAMP, completed_at TIMESTAMP, family_ready_at TIMESTAMP, last_updated_by INT,
        last_updated_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW(), UNIQUE (visit_id, station));
      CREATE TEMP TABLE visit_station_route_history (id SERIAL PRIMARY KEY, visit_id INT, previous_stations JSONB,
        requested_stations JSONB, last_updated_by INT, created_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE tb_screening (visit_id INT PRIMARY KEY, red_flags TEXT[] DEFAULT '{}', flag_notes TEXT DEFAULT '', status TEXT,
        doctor_notes TEXT DEFAULT '', flagged_by INT, flagged_at TIMESTAMP DEFAULT NOW(), reviewed_by INT, reviewed_at TIMESTAMP,
        last_updated_by INT, last_updated_at TIMESTAMP DEFAULT NOW());
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
    app.use('/api/tb', require('../routes/tb'));
    app.use('/api/registration', require('../routes/registration'));
  });

  // Patients 1-3 are the Tan family, 4 is Sok, 5 is Dara and 6 is Vanna, who has
  // no visit today. Visits 3, 4, 5 and 6 (patients 1-4) wait at Triage, then go to Consult.
  beforeEach(() => client.query(`
    TRUNCATE tb_screening, visit_station_route_history, visit_stations, visits, patients, users RESTART IDENTITY CASCADE;
    INSERT INTO users VALUES (1), (${USER_ID});
    INSERT INTO patients (id, english_name, last_updated_by) VALUES
      (1, 'Mother Tan', 1), (2, 'Father Tan', 1), (3, 'Child Tan', 1), (4, 'Sok', 1), (5, 'Dara', 1), (6, 'Vanna', 1);
    INSERT INTO visits (id, patient_id, queue_no, visit_date, last_updated_by) VALUES
      (3, 1, '3', '${DAY}', 1), (4, 2, '4', '${DAY}', 1), (5, 3, '5', '${DAY}', 1), (6, 4, '6', '${DAY}', 1);
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

    test('the same patient, or one who does not exist, is refused', async () => {
      expect((await join(1, 1)).status).toBe(400);
      expect((await join(1, 99)).status).toBe(404);
      expect((await leave(99)).status).toBe(404);
      expect(await families()).toMatchObject({ 1: null, 5: null });
    });
  });

  describe('grouping several at once (the queue)', () => {
    test('patients not in a family start one; dropping more on a family adds them to it', async () => {
      const res = await group([1, 2, 3]);
      expect(res.status).toBe(200);
      expect(res.body.family).toBe('A');
      expect(await families()).toMatchObject({ 1: 'A', 2: 'A', 3: 'A', 4: null });
      expect((await group([4, 1])).body.family).toBe('A');
      expect(await families()).toMatchObject({ 4: 'A' });
    });

    test('the family most of them are in takes the rest; a family left with one member is dissolved', async () => {
      await group([1, 2]); // A
      await group([3, 4, 5]); // B
      // 1 and 2 of A, 3 of B: they become A, and B (4, 5) keeps two members.
      expect((await group([3, 1, 2])).body.family).toBe('A');
      expect(await families()).toMatchObject({ 1: 'A', 2: 'A', 3: 'A', 4: 'B', 5: 'B' });
      // 4 joins A: B is left with only 5, so it is dissolved.
      await group([1, 4]);
      expect(await families()).toMatchObject({ 4: 'A', 5: null });
    });

    test('fewer than two patients, bad ids, or a patient who does not exist are refused', async () => {
      for (const ids of [[1], [1, 1], 'x', [1, 0], Array.from({ length: 21 }, (_, i) => i + 1)]) {
        expect((await group(ids)).status).toBe(400);
      }
      expect((await group([1, 99])).status).toBe(404);
      expect(await families()).toMatchObject({ 1: null });
    });
  });

  describe('moving together', () => {
    beforeEach(async () => { await join(2, 1); });

    test('finishing a member takes the family members at the same station with them', async () => {
      const res = await done(3, 'triage');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ held: false, next_station: 'consultation',
        family_moved: [{ visit_id: 4, queue_no: '4', next_station: 'consultation' }] });
      // Sok (visit 6) has no family and stays.
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'consultation', 6: 'triage' });
      const { rows } = await client.query("SELECT completed_at IS NOT NULL AS done FROM visit_stations WHERE visit_id = 4 AND station = 'triage'");
      expect(rows[0].done).toBe(true);
      // Finishing the last station finishes the family's visits too.
      await done(4, 'consultation');
      expect(await stations()).toMatchObject({ 3: 'finished', 4: 'finished' });
    });

    test('a member at another station, or on another day, stays where they are', async () => {
      await join(3, 1);
      await client.query("UPDATE visit_stations SET completed_at = NOW() WHERE visit_id = 5 AND station = 'triage'");
      await client.query(`INSERT INTO visits (id, patient_id, queue_no, visit_date, last_updated_by) VALUES (9, 2, '1', '2026-11-04', 1);
        INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by) VALUES (9, 'triage', 1, NOW(), 1);`);
      await client.query("UPDATE visit_stations SET completed_at = NOW() WHERE visit_id = 9");
      expect((await done(3, 'triage')).body.family_moved.map(m => m.visit_id)).toEqual([4]);
    });

    test('Send to sends the family members at the same station to the same station', async () => {
      const res = await auth(request(app).put('/api/queue/4/stations')).send({
        stations: ['consultation'], ordered: true,
        expected_stations: [{ station: 'triage', completed: false }, { station: 'consultation', completed: false }],
      });
      expect(res.body.family_moved).toEqual([{ visit_id: 3, queue_no: '3', next_station: 'consultation' }]);
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'consultation', 6: 'triage' });
      // Triage was taken off the patient's route, so off the family member's too.
      const { rows } = await client.query("SELECT 1 FROM visit_stations WHERE visit_id = 3 AND station = 'triage'");
      expect(rows).toHaveLength(0);
    });

    test('a member flagged for TB takes the family in the queue straight to Consult', async () => {
      await join(3, 1);
      const flag = await post('/api/tb/4/flag', { flagged: true, red_flags: ['cough_2_weeks', 'fever', 'night_sweats'] });
      expect(flag.body.current_station).toBe('consultation');
      expect(flag.body.family_moved.map(m => m.visit_id).sort()).toEqual([3, 5]);
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'consultation', 5: 'consultation', 6: 'triage' });
      // The others keep Triage, unfinished, for after Consult.
      const { rows } = await client.query("SELECT completed_at FROM visit_stations WHERE visit_id = 3 AND station = 'triage'");
      expect(rows[0].completed_at).toBeNull();
    });

    test('the family stays at Consult with a member flagged for TB until the flag is cleared', async () => {
      await post('/api/tb/4/flag', { flagged: true, red_flags: ['cough_2_weeks', 'fever', 'night_sweats'] });
      const refused = await done(3, 'consultation');
      expect(refused.status).toBe(409);
      expect(refused.body.error).toMatch(/4 Father Tan is flagged/);
      const sent = await auth(request(app).put('/api/queue/3/stations')).send({
        stations: ['triage'], ordered: true,
        expected_stations: [{ station: 'consultation', completed: false }, { station: 'triage', completed: false }],
      });
      expect(sent.status).toBe(409);
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'consultation' });

      // Cleared, the family leaves Consult together: finishing either takes the other along.
      expect((await post('/api/tb/4/flag', { flagged: false })).status).toBe(200);
      const res = await done(3, 'consultation');
      expect(res.body).toMatchObject({ next_station: 'triage', family_moved: [{ visit_id: 4, next_station: null }] });
      expect(await stations()).toMatchObject({ 3: 'triage', 4: 'finished' });
    });

    test('a member waiting for family from an older visit moves on when the family is dissolved', async () => {
      await client.query("UPDATE visit_stations SET family_ready_at = NOW() WHERE visit_id = 3 AND station = 'triage'");
      await leave(2); // A had two members: dissolved
      expect(await families()).toMatchObject({ 1: null, 2: null });
      expect(await stations()).toMatchObject({ 3: 'consultation', 4: 'triage' });
    });
  });
});
