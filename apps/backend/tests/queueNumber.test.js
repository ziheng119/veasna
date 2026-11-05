// Registration always assigns the next queue number itself (routes/visits.js).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');

describe('Automatic queue numbers at registration', () => {
  const secret = 'queue-number-tests';
  let app, previousSecret, client;

  beforeAll(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    app = express();
    app.use(express.json());
    app.use('/api/visits', require('../routes/visits'));
  });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  // Patients 1-13 already issued today, so the next number is 14.
  beforeEach(() => {
    client = { release: jest.fn(), query: jest.fn(async sql => {
      if (sql.includes('next_queue_no')) return { rows: [{ next_queue_no: 14 }] };
      if (sql.includes('INSERT INTO patients')) return { rows: [{ id: 8 }] };
      if (sql.includes('INSERT INTO visits')) return { rows: [{ id: 9, created_at: new Date() }] };
      return { rows: [] };
    }) };
    db.pool.connect.mockResolvedValue(client);
  });

  const register = visit => request(app).post('/api/visits')
    .set('Authorization', `Bearer ${jwt.sign({ id: 1, role: 'user' }, secret)}`)
    .send({
      patientInfo: { english_name: 'Test Only', location_id: 1, sex: 'F' },
      ...(visit ? { visit } : {}), stations: ['triage'], hef: {},
      vitals: { height: 160, weight: 50, bmi: 19.5, bp_systolic: 110, bp_diastolic: 70, temperature: 37, below_3rd_percentile: false },
    });
  const sql = () => client.query.mock.calls.map(([text]) => text);

  test('the next number is assigned', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.queue_no).toBe('14');
  });

  test.each(['132', '13A', 'A50', 'not a number'])('a number sent by an older app (%s) is ignored', async queueNo => {
    const res = await register({ queue_no: queueNo });
    expect(res.status).toBe(201);
    expect(res.body.queue_no).toBe('14');
  });

  test('the queue is locked before the next number is read, so devices registering at once get different numbers', async () => {
    await register();
    const lock = sql().findIndex(text => text.includes('pg_advisory_xact_lock'));
    const next = sql().findIndex(text => text.includes('next_queue_no'));
    const insert = sql().findIndex(text => text.includes('INSERT INTO visits'));
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(next);
    expect(next).toBeLessThan(insert);
    expect(sql()).toContain('COMMIT');
  });
});
