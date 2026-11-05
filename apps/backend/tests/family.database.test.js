// Families share a queue number letter (utils/family.js, routes/family.js). The route tests use real
// PostgreSQL temp tables: run with RUN_DB_TESTS=1 and a configured apps/backend/.env.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');
const { splitQueueNo, familyLetters, nextFamilyLetters } = require('../utils/family');

describe('family letters', () => {
  test.each([['12', { base: '12', letters: '' }], ['12a', { base: '12', letters: 'A' }], ['3AB', { base: '3', letters: 'AB' }], ['A12', null], ['1-2', null]])(
    'splits %s', (queueNo, expected) => expect(splitQueueNo(queueNo)).toEqual(expected));

  test('go A to Z, then AA, AB', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(familyLetters)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });

  test('the next family takes the first unused letter of the day', () => {
    expect(nextFamilyLetters(['1', '2'])).toBe('A');
    expect(nextFamilyLetters(['3A', '4A', '6'])).toBe('B');
    expect(nextFamilyLetters(['3B', '9'])).toBe('A');
    // Older lettered-series numbers ("A12") are not families.
    expect(nextFamilyLetters(['A12'])).toBe('A');
  });
});

const USER_ID = 2;

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('grouping families', () => {
  let client, app, previousSecret;
  const secret = 'family-test';
  const post = (url, body) => request(app).post(url)
    .set('Authorization', `Bearer ${jwt.sign({ id: USER_ID, role: 'user' }, secret)}`).send(body);
  const join = (visit_id, with_visit_id) => post('/api/family', { visit_id, with_visit_id });
  const numbers = async () => Object.fromEntries((await client.query('SELECT id, queue_no FROM visits ORDER BY id')).rows.map(r => [r.id, r.queue_no]));

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
    const setup = fs.readFileSync(path.join(__dirname, '../db_setup.sql'), 'utf8').replace(/\r\n/g, '\n');
    const start = setup.indexOf('CREATE TABLE visits (');
    const sql = setup.slice(start, setup.indexOf('\n);', start) + 3)
      .replace(/REFERENCES (patients|locations)\(id\)\s+ON DELETE \w+( NULL)? ON UPDATE CASCADE/g, '');
    await client.query(sql.replace('CREATE TABLE', 'CREATE TEMP TABLE'));
    db.query.mockImplementation((...args) => client.query(...args));
    db.pool.connect.mockImplementation(async () => ({ query: (...args) => client.query(...args), release() {} }));
    app = express();
    app.use(express.json());
    app.use('/api/family', require('../routes/family'));
  });

  // The Tan family registered as 3, 4 and 5; 6 is someone else; 7 is at another location; 8 another day.
  beforeEach(() => client.query(`
    TRUNCATE visits, users RESTART IDENTITY CASCADE;
    INSERT INTO users VALUES (1), (${USER_ID});
    INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES
      (3, 1, 1, '3', '2026-11-05', 1), (4, 2, 1, '4', '2026-11-05', 1), (5, 3, 1, '5', '2026-11-05', 1),
      (6, 4, 1, '6', '2026-11-05', 1), (7, 5, 2, '1', '2026-11-05', 1), (8, 6, 1, '3', '2026-11-04', 1);`));

  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  test('the Tan family 3, 4 and 5 become 3A, 4A and 5A', async () => {
    const first = await join(4, 3);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ family: 'A', visits: [{ visit_id: 4, queue_no: '4A' }, { visit_id: 3, queue_no: '3A' }] });
    expect((await join(5, 4)).body.family).toBe('A');
    expect(await numbers()).toMatchObject({ 3: '3A', 4: '4A', 5: '5A', 6: '6' });
    const { rows } = await client.query('SELECT last_updated_by FROM visits WHERE id IN (3, 4, 5)');
    expect(rows.every(row => row.last_updated_by === USER_ID)).toBe(true);
  });

  test('the next family gets the next letter; another location or day starts again at A', async () => {
    await join(4, 3);
    await client.query("INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES (9, 7, 1, '9', '2026-11-05', 1)");
    expect((await join(9, 6)).body.family).toBe('B');
    expect(await numbers()).toMatchObject({ 6: '6B', 9: '9B', 8: '3' });
  });

  test('joining another family moves the patient; leaving takes the letter off', async () => {
    await join(4, 3);
    await join(6, 5);
    expect((await join(5, 3)).body.visits[0]).toEqual({ visit_id: 5, queue_no: '5A' });
    expect(await numbers()).toMatchObject({ 3: '3A', 4: '4A', 5: '5A', 6: '6B' });
    const left = await post('/api/family/leave', { visit_id: 4 });
    expect(left.body).toEqual({ visit_id: 4, queue_no: '4' });
    expect(await numbers()).toMatchObject({ 3: '3A', 4: '4', 5: '5A' });
    expect((await post('/api/family/leave', { visit_id: 4 })).body.queue_no).toBe('4');
  });

  test('patients at another location or on another day, or the same patient, are refused', async () => {
    expect((await join(3, 7)).status).toBe(400);
    expect((await join(3, 8)).status).toBe(400);
    expect((await join(3, 3)).status).toBe(400);
    expect((await join(3, 99)).status).toBe(404);
    expect(await numbers()).toMatchObject({ 3: '3', 7: '1', 8: '3' });
  });

  test('an older typed number in the way is reported, and nothing changes', async () => {
    await client.query("INSERT INTO visits (id, patient_id, location_id, queue_no, visit_date, last_updated_by) VALUES (10, 8, 1, '3A', '2026-11-05', 1), (11, 9, 1, 'A12', '2026-11-05', 1)");
    // 3A is taken by visit 10, so 3 can't join family A (started by 10's letter).
    const res = await join(3, 10);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/3A is already used/);
    expect((await join(3, 11)).status).toBe(400);
    // Leaving would make 3A plain 3, which visit 3 has.
    expect((await post('/api/family/leave', { visit_id: 10 })).status).toBe(409);
    expect(await numbers()).toMatchObject({ 3: '3', 10: '3A' });
  });
});
