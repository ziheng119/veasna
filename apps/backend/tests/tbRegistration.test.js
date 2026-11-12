// Registration stations (routes/visits.js): a patient registered with TB red flags goes only to
// Consultation, and Physiotherapy and Pharmacy can't be chosen at registration.
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
      patientInfo: { english_name: 'Test Only', sex: 'F' }, visit: {}, hef: {},
      vitals: { height: 160, weight: 50, bmi: 19.5, bp_systolic: 110, bp_diastolic: 70, temperature: 37, below_3rd_percentile: false },
      ...body,
    });
  const THREE_FLAGS = ['cough_2_weeks', 'fever', 'night_sweats'];
  // [station, position, entered now?] for each queued station, in insert order.
  const queued = () => client.query.mock.calls
    .filter(([sql]) => sql.includes('INSERT INTO visit_stations'))
    .map(([, params]) => [params[1], params[2], params[3]]);

  test('a flagged patient is queued only at Consultation, whatever stations were ticked', async () => {
    const res = await register({ stations: ['triage', 'seva', 'consultation'], tb: { red_flags: THREE_FLAGS, notes: '' } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ current_station: 'consultation', tb_status: 'suspected' });
    expect(queued()).toEqual([['consultation', 1, true]]);
  });

  test('Consultation is used for a flagged patient who was not sent there', async () => {
    await register({ stations: ['triage', 'dental'], tb: { red_flags: THREE_FLAGS } });
    expect(queued()).toEqual([['consultation', 1, true]]);
  });

  test('fewer than 3 red flags are refused and nothing is saved', async () => {
    const res = await register({ stations: ['triage'], tb: { red_flags: ['fever', 'night_sweats'] } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/3 or more red flags/);
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  test('registration offers Triage, Dental, Consult and the partner NGO, defaulting to the first three', async () => {
    for (const station of ['physiotherapy', 'pharmacy']) {
      const res = await register({ stations: ['triage', station] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Physiotherapy is chosen at Consultation and Pharmacy is added on prescribing/);
    }
    await register({});
    expect(queued().map(([station]) => station)).toEqual(['triage', 'dental', 'consultation']);
  });

  test('the sticker colour is saved on the visit, and must be on the sticker colours list', async () => {
    db.query.mockResolvedValue({ rows: [] }); // no saved list: the built-in colours apply
    const visitInsert = () => client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO visits'));
    const res = await register({ sticker_colour: 'light_blue' });
    expect(res.status).toBe(201);
    expect(res.body.sticker_colour).toBe('light_blue');
    expect(visitInsert()[1][4]).toBe('light_blue');

    jest.clearAllMocks();
    db.pool.connect.mockResolvedValue(client);
    await register({ sticker_colour: '' });
    expect(visitInsert()[1][5]).toBeNull();

    jest.clearAllMocks();
    const bad = await register({ sticker_colour: 'tartan' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/sticker_colour must be one of: silver, gold/);
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  test('other patients keep the normal order', async () => {
    const res = await register({ stations: ['consultation', 'triage'] });
    expect(res.body.current_station).toBe('triage');
    expect(queued()).toEqual([['triage', 1, true], ['consultation', 2, false]]);
  });
});
