// Registration refuses typed queue numbers that would make the sequence skip (routes/visits.js).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');

describe('Typed queue numbers at registration', () => {
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

  const register = queueNo => request(app).post('/api/visits')
    .set('Authorization', `Bearer ${jwt.sign({ id: 1, role: 'user' }, secret)}`)
    .send({
      patientInfo: { english_name: 'Test Only', location_id: 1, sex: 'F' },
      visit: { queue_no: queueNo }, stations: ['triage'], hef: {},
      vitals: { height: 160, weight: 50, bmi: 19.5, bp_systolic: 110, bp_diastolic: 70, temperature: 37, below_3rd_percentile: false },
    });
  const inserted = () => client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO visits'));

  test('"132" typed for "13A" is refused and nothing is saved', async () => {
    const res = await register('132');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ahead of the next number, 14.*e\.g\. 13A/);
    expect(inserted()).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test.each(['13a', '14', 'A50'])('%s is accepted', async queueNo => {
    const res = await register(queueNo);
    expect(res.status).toBe(201);
    expect(res.body.queue_no).toBe(queueNo.toUpperCase());
  });

  test('a blank number is assigned the next one', async () => {
    const res = await register('');
    expect(res.status).toBe(201);
    expect(res.body.queue_no).toBe('14');
  });
});
