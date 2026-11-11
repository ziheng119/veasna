// tests/basic.test.js

const request = require('supertest');

// Isolated from PostgreSQL: the health check's database probe is mocked.
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn(), end: jest.fn() } }));
const db = require('../config/db');
const app = require('../server');

describe('Basic API Tests', () => {
  test('Health check reports a reachable database', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'OK', database: 'ok', realtimeClients: 0 });
  });

  test("Health check reports the host's clock, so devices can use the host's date", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const before = Date.now();
    const { body } = await request(app).get('/health');
    expect(Date.parse(body.server_time)).toBeGreaterThanOrEqual(before - 1000);
    expect(body.server_date).toBe(require('../utils/validation').localDate());
    expect(body.utc_offset_minutes).toBe(-new Date().getTimezoneOffset());
  });

  test('Health check returns 503 when PostgreSQL is unreachable', async () => {
    db.query.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const response = await request(app).get('/health');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 'DEGRADED', database: 'unreachable' });
  });

  test('404 for unknown routes', async () => {
    const response = await request(app).get('/unknown');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', 'Route not found');
  });
});
