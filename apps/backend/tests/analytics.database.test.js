// Uses only connection-local temporary tables; clinic data is never modified.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn() }));
const db = require('../config/db');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Admin clinic analytics', () => {
  let client, app, previousSecret;
  const secret = 'analytics-test-secret';
  const token = (id = 1, role = 'admin') => jwt.sign({ id, role }, secret);
  const get = (auth = token(), query = { location_id: 1, date: '2026-10-21' }) => {
    const call = request(app).get('/').query(query);
    return auth ? call.set('Authorization', `Bearer ${auth}`) : call;
  };
  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id INT, role TEXT, is_active BOOLEAN);
      INSERT INTO users VALUES (1,'admin',TRUE),(2,'user',TRUE),(3,'admin',FALSE);
      CREATE TEMP TABLE patients (id INT, date_of_birth DATE);
      INSERT INTO patients VALUES (1,'2000-01-01'),(2,'1950-01-01'),(3,NULL),(4,'2030-01-01');
      CREATE TEMP TABLE visits (id INT, patient_id INT, location_id INT, visit_date DATE, completed_at TIMESTAMP);
      INSERT INTO visits VALUES
        (1,1,1,'2026-10-21',NOW()),(2,1,1,'2026-10-21',NULL),(3,2,1,'2026-10-21',NOW()),
        (4,3,1,'2026-10-21',NULL),(5,4,1,'2026-10-21',NULL),
        (6,1,2,'2026-10-21',NULL),(7,1,1,'2026-10-20',NULL);
      CREATE TEMP TABLE visit_stations (visit_id INT, station TEXT, position INT, completed_at TIMESTAMP);
      INSERT INTO visit_stations VALUES
        (1,'consultation',1,NOW()),(2,'consultation',1,NOW()),(3,'consultation',1,NOW()),
        (4,'triage',1,NULL),(4,'seva',2,NULL),(5,'triage',1,NOW()),(5,'consultation',2,NULL),
        (6,'consultation',1,NOW()),(7,'consultation',1,NOW());
      CREATE TEMP TABLE referral (visit_id INT, referral_type TEXT, signature JSONB);
      INSERT INTO referral VALUES (1,E'Dentist\\nDentist\\nSEVA\\n','[]'),(3,'Dentist',NULL),(6,'Dentist',NULL);
      CREATE TEMP TABLE consultation (visit_id INT, notes TEXT);
      INSERT INTO consultation VALUES (1,'Clinical note'),(2,'  '),(3,'Note'),(6,'Excluded');
    `);
    db.query.mockImplementation((...args) => client.query(...args));
    app = express(); app.use(require('../routes/analytics'));
  });
  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  test('enforces authentication and current active admin permissions', async () => {
    expect((await get(null)).status).toBe(401);
    expect((await get(token(2, 'user'))).status).toBe(403);
    expect((await get(token(2))).status).toBe(403); // Stale admin token.
    expect((await get(token(3))).status).toBe(403);
  });
  test('counts distinct people, visits, current queues and multi-destination referrals without join inflation', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.summary).toEqual({ people: 4, visits: 5, consultedPeople: 2, dischargedVisits: 2, referralVisits: 2, notesSaved: 2, unsignedReferrals: 1 });
    expect(response.body.stations).toEqual(expect.arrayContaining([
      { station: 'consultation', assigned: 4, completed: 3, waiting: 1 },
      { station: 'triage', assigned: 2, completed: 1, waiting: 1 },
      { station: 'seva', assigned: 1, completed: 0, waiting: 0 },
    ]));
    expect(response.body.ages).toEqual(expect.arrayContaining([{ label: 'Unknown', count: 2 }, { label: '18–59', count: 1 }, { label: '60+', count: 1 }]));
    expect(response.body.destinations).toEqual([{ label: 'Dentist', count: 2 }, { label: 'SEVA', count: 1 }]);
    expect(JSON.stringify(response.body)).not.toContain('Clinical note');
  });
  test('empty dates are zero, invalid filters are rejected', async () => {
    const empty = await get(token(), { location_id: 1, date: '2026-10-22' });
    expect(empty.body.summary.people).toBe(0);
    expect(empty.body.stations).toEqual([]);
    for (const filters of [{}, { location_id: 1, date: '2026-02-30' }, { location_id: -1, date: '2026-10-21' }]) {
      expect((await get(token(), filters)).status).toBe(400);
    }
  });
});
