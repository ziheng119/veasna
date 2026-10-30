// Errors that previously hung requests or surfaced as 500s for bad client input.
const express = require('express');
const request = require('supertest');

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
