// Errors that previously hung requests or surfaced as 500s for bad client input.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn(), end: jest.fn() } }));
const db = require('../config/db');
const app = require('../server');

describe('Async handler errors (Express 4)', () => {
  test('an error thrown in an async handler is answered instead of hanging', async () => {
    require('../middleware/asyncErrors');
    const local = express();
    local.get('/boom', async () => { throw new Error('unexpected'); });
    local.use((err, req, res, next) => res.status(500).json({ message: err.message }));
    const response = await request(local).get('/boom').timeout(3000);
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('unexpected');
  });

  test('login with a non-string username returns 400 (previously hung)', async () => {
    const response = await request(app).post('/api/auth/login')
      .send({ username: { a: 1 }, password: 'x' }).timeout(3000);
    expect(response.status).toBe(400);
  });
});

describe('Global error handler', () => {
  let warn, secret;
  beforeAll(() => { secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'error-test'; });
  afterAll(() => { process.env.JWT_SECRET = secret; });
  beforeEach(() => { warn = jest.spyOn(console, 'error').mockImplementation(() => {}); db.query.mockReset(); });
  afterEach(() => warn.mockRestore());

  test('malformed JSON is a 400, not a 500', async () => {
    const response = await request(app).post('/api/auth/login')
      .set('Content-Type', 'application/json').send('{"username":');
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/not valid JSON/);
  });

  test('non-integer route IDs are rejected before the database', async () => {
    const token = jwt.sign({ id: 1, role: 'admin' }, 'error-test');
    db.query.mockResolvedValue({ rows: [{ id: 1, username: 'admin', role: 'admin', is_active: true }] });
    const response = await request(app).get('/api/patient/abc').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    // Only the account lookup ran; the patient query never reached PostgreSQL.
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
