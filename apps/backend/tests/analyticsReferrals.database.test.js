// Analytics referral lists: patients referred to each destination.
// The grouping test needs no database. The route test uses only connection-local temporary
// tables (RUN_DB_TESTS=1 and a configured apps/backend/.env); clinic data is never modified.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn() }));
const db = require('../config/db');
const { groupReferralLists } = require('../routes/analytics');
const DEFAULT_DESTINATIONS = require('../../../shared/formOptions.json').referral_destinations.map(option => option.label);

const LISTED = [
  { id: 'Preah Ang Duong Hospital', label: 'Preah Ang Duong Hospital' },
  { id: 'Samdech Ov Referral Hospital', label: 'Samdech Ov Referral Hospital' },
  { id: 'Optician', label: 'Optician' },
];

describe('groupReferralLists', () => {
  test('lists every current destination in order, merges case and spacing, then older names', () => {
    const groups = groupReferralLists([
      { destination: 'OPTICIAN', visitId: 1 },
      { destination: 'Dentist', visitId: 2 },
      { destination: 'preah  ang duong hospital', visitId: 3 },
      { destination: 'Optician', visitId: 4 },
      { destination: 'SEVA', visitId: 5 },
      { destination: 'SEVA', visitId: 6 },
    ], LISTED);
    expect(groups.map(group => [group.label, group.listed, group.patients.map(p => p.visitId)])).toEqual([
      ['Preah Ang Duong Hospital', true, [3]],
      ['Samdech Ov Referral Hospital', true, []],
      ['Optician', true, [1, 4]],
      ['SEVA', false, [5, 6]],
      ['Dentist', false, [2]],
    ]);
    // The destination is the group's label, not repeated on each patient.
    expect(groups[0].patients[0]).toEqual({ visitId: 3 });
  });
});

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('GET /analytics/referrals', () => {
  let client, app, previousSecret;
  const secret = 'analytics-referrals-test-secret';
  const token = (id = 1, role = 'admin') => jwt.sign({ id, role }, secret);
  const get = (auth = token(), query = { date: '2026-10-21' }) => {
    const call = request(app).get('/referrals').query(query);
    return auth ? call.set('Authorization', `Bearer ${auth}`) : call;
  };

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id INT, role TEXT, is_active BOOLEAN, screening_date DATE, permissions TEXT[]);
      INSERT INTO users (id, role, is_active) VALUES (1,'admin',TRUE),(2,'user',TRUE);
      CREATE TEMP TABLE patients (id INT, english_name TEXT, khmer_name TEXT, sex TEXT, date_of_birth DATE, phone_number TEXT, address TEXT);
      INSERT INTO patients VALUES
        (1,'Ben','បេន','M','1990-10-22','012 345 678','Village A'),
        (2,'Bob',NULL,'M',NULL,NULL,NULL),
        (3,'Beb',NULL,'F','2030-01-01',NULL,NULL),
        (4,'Other day',NULL,'F',NULL,NULL,NULL);
      CREATE TEMP TABLE visits (id INT, patient_id INT, queue_no TEXT, visit_date DATE, created_at TIMESTAMP);
      INSERT INTO visits VALUES
        (1,1,'3','2026-10-21','2026-10-21 09:00'),(2,2,'1','2026-10-21','2026-10-21 08:00'),
        (3,3,'7','2026-10-21','2026-10-21 08:30'),(4,4,'2','2026-10-19','2026-10-19 08:00');
      CREATE TEMP TABLE referral (visit_id INT, referral_type TEXT, referral_date DATE, illness TEXT, reason TEXT, signature JSONB);
      INSERT INTO referral VALUES
        (1,E'PREAH ANG DUONG HOSPITAL\\nOptician\\nOptician','2026-10-21','Cataract','Needs surgery','[]'),
        (2,'Preah Ang Duong Hospital',NULL,'','',NULL),
        (3,'Optician',NULL,'','',NULL),
        (4,'Optician',NULL,'','',NULL);
    `);
    db.query.mockImplementation((...args) => client.query(...args));
    app = express(); app.use(require('../routes/analytics'));
  });
  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  test('needs the analytics permission and is never cached', async () => {
    expect((await get(null)).status).toBe(401);
    expect((await get(token(2, 'user'))).status).toBe(403);
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  test('lists each destination with its patients, in arrival order, for the filters', async () => {
    const { body } = await get();
    const byLabel = Object.fromEntries(body.destinations.map(group => [group.label, group.patients]));
    // No form_options table here, so the built-in choices are listed first, each once, even when
    // nobody was referred there.
    const listed = body.destinations.filter(group => group.listed).map(group => group.label);
    expect(listed).toEqual(DEFAULT_DESTINATIONS);
    expect(body.destinations.slice(0, listed.length).every(group => group.listed)).toBe(true);
    expect(byLabel['Preah Ang Duong Hospital'].map(p => p.englishName)).toEqual(['Bob', 'Ben']);
    // Optician is written twice on Ben's referral but listed once.
    expect(byLabel.Optician.map(p => p.englishName)).toEqual(['Beb', 'Ben']);
    // Beb's date of birth is after the visit, so no age is shown.
    expect(byLabel.Optician[0].age).toBeNull();
    expect(byLabel.Optician[1]).not.toHaveProperty('locationName');
    expect(byLabel.Optician[1]).toMatchObject({
      visitId: 1, patientId: 1, queueNo: '3', visitDate: '2026-10-21', khmerName: 'បេន',
      sex: 'M', age: 35, phone: '012 345 678', address: 'Village A', referralDate: '2026-10-21',
      condition: 'Cataract', reason: 'Needs surgery', signed: true,
    });
    expect(byLabel['Preah Ang Duong Hospital'][0]).toMatchObject({ signed: false, age: null });
  });

  test('longer periods include more visits; bad filters are refused', async () => {
    const week = await get(token(), { date: '2026-10-21', period: 'week' });
    expect(week.body.destinations.find(group => group.label === 'Optician').patients.map(p => p.englishName)).toEqual(['Other day', 'Beb', 'Ben']);
    expect((await get(token(), { date: '2026-10-21', period: 'year' })).status).toBe(400);
    expect((await get(token(), {})).status).toBe(400);
  });
});
