// tests/locations.test.js

const request = require('supertest');
const app = require('../server');

describe('Locations API', () => {
  test('GET /api/locations returns active locations (public)', async () => {
    const res = await request(app).get('/api/locations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.locations)).toBe(true);
    // seeded names
    const names = res.body.locations.map(l => l.name);
    expect(names).toEqual(expect.arrayContaining(['Poipet', 'Mongkol Borey', 'Sisophon']));
  });
});
