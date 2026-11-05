// A patient registered with TB red flags goes straight to Consultation (routes/visits.js).
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');

describe('Registering a suspected TB patient', () => {
  const secret = 'tb-registration-tests';
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
  beforeEach(() => {
    jest.clearAllMocks();
    client = { release: jest.fn(), query: jest.fn(async sql => {
      if (sql.includes('next_queue_no')) return { rows: [{ next_queue_no: 1 }] };
      if (sql.includes('INSERT INTO patients')) return { rows: [{ id: 8 }] };
      if (sql.includes('INSERT INTO visits')) return { rows: [{ id: 9, created_at: new Date() }] };
      return { rows: [] };
    }) };
    db.pool.connect.mockResolvedValue(client);
  });

  const register = body => request(app).post('/api/visits')
    .set('Authorization', `Bearer ${jwt.sign({ id: 1, role: 'user' }, secret)}`)
    .send({
      patientInfo: { english_name: 'Test Only', location_id: 1, sex: 'F' }, visit: {}, hef: {},
      vitals: { height: 160, weight: 50, bmi: 19.5, bp_systolic: 110, bp_diastolic: 70, temperature: 37, below_3rd_percentile: false },
      ...body,
    });
  const THREE_FLAGS = ['cough_2_weeks', 'fever', 'night_sweats'];
  // [station, position, entered now?] for each queued station, in insert order.
  const queued = () => client.query.mock.calls
    .filter(([sql]) => sql.includes('INSERT INTO visit_stations'))
    .map(([, params]) => [params[1], params[2], params[3]]);

  test('a flagged patient starts at Consultation, then their other stations in order', async () => {
    const res = await register({ stations: ['triage', 'seva', 'consultation'], tb: { red_flags: THREE_FLAGS, notes: '' } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ current_station: 'consultation', tb_status: 'suspected' });
    expect(queued()).toEqual([['consultation', 1, true], ['triage', 2, false], ['seva', 3, false]]);
  });

  test('Consultation is added for a flagged patient who was not sent there', async () => {
    await register({ stations: ['triage', 'physiotherapy'], tb: { red_flags: THREE_FLAGS } });
    expect(queued().map(([station]) => station)).toEqual(['consultation', 'triage', 'physiotherapy']);
  });

  test('fewer than 3 red flags are refused and nothing is saved', async () => {
    const res = await register({ stations: ['triage'], tb: { red_flags: ['fever', 'night_sweats'] } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/3 or more red flags/);
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  test('other patients keep the normal order', async () => {
    const res = await register({ stations: ['consultation', 'triage'] });
    expect(res.body.current_station).toBe('triage');
    expect(queued()).toEqual([['triage', 1, true], ['consultation', 2, false]]);
  });
});
