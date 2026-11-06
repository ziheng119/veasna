// GET /api/patients: each patient's place in today's queue, for the Patient List's Current Station
// column (routes/patients.js). Real PostgreSQL temp tables: run with RUN_DB_TESTS=1 and a configured
// apps/backend/.env.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const path = require('path');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');
const { currentVisitDate } = require('../utils/queueNumber');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Patient List current station', () => {
  let client, app, previousSecret;
  const secret = 'patient-list-test';

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
      CREATE TEMP TABLE locations (id INT PRIMARY KEY, name TEXT);
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, location_id INT, english_name TEXT, family TEXT);
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT, location_id INT, visit_date DATE, completed_at TIMESTAMP);
      CREATE TEMP TABLE visit_stations (id SERIAL PRIMARY KEY, visit_id INT, station TEXT, position INT, completed_at TIMESTAMP);`);
    db.query.mockImplementation((...args) => client.query(...args));
    app = express();
    app.use('/api/patients', require('../routes/patients'));
  });

  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  test('a patient waiting today shows their visit and station; finished, other-day and unqueued patients show none', async () => {
    const today = currentVisitDate();
    await client.query(`
      INSERT INTO locations VALUES (1, 'Village');
      INSERT INTO patients VALUES (1, 1, 'Ann', NULL), (2, 1, 'Bo', NULL), (3, 1, 'Chan', NULL), (4, 1, 'Dara', NULL);
      INSERT INTO visits VALUES (10, 1, 1, '${today}', NULL), (11, 2, 1, '${today}', NOW()), (12, 3, 1, '2026-01-01', NULL);
      INSERT INTO visit_stations (visit_id, station, position, completed_at) VALUES
        (10, 'triage', 1, NOW()), (10, 'dental', 2, NULL), (11, 'triage', 1, NULL), (12, 'triage', 1, NULL);`);
    const res = await request(app).get('/api/patients').query({ location_id: 1 })
      .set('Authorization', `Bearer ${jwt.sign({ id: 1, role: 'user' }, secret)}`);
    expect(res.status).toBe(200);
    expect(res.body.map(({ english_name, queue_visit_id, current_station }) => [english_name, queue_visit_id, current_station])).toEqual([
      ['Ann', 10, 'dental'], ['Bo', null, null], ['Chan', null, null], ['Dara', null, null],
    ]);
    // The date filter still works alongside it.
    const filtered = await request(app).get('/api/patients').query({ location_id: 1, visit_date: '2026-01-01' })
      .set('Authorization', `Bearer ${jwt.sign({ id: 1, role: 'user' }, secret)}`);
    expect(filtered.body.map(p => p.english_name)).toEqual(['Chan']);
  });
});
