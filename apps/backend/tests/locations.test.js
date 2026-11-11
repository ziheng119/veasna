// Clinic locations (routes/locations.js) through the API gateway, and the older endpoints that were
// removed. The database is mocked.
const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn(), end: jest.fn() } }));
const db = require('../config/db');

describe('Locations API', () => {
  let app, previousSecret;
  const token = role => jwt.sign({ id: 1, role }, 'locations-test');
  // authorizeApi reads the account, then the route runs its query.
  const signedIn = (role, ...results) => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: role, role, is_active: true, screening_date: null }] });
    for (const rows of results) db.query.mockResolvedValueOnce({ rows });
  };
  beforeAll(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'locations-test';
    app = require('../server');
  });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  });
  beforeEach(() => db.query.mockReset());

  test('listing needs a sign-in, then returns the active locations', async () => {
    expect((await request(app).get('/api/locations')).status).toBe(401);
    signedIn('user', [{ id: 1, name: 'Poipet' }]);
    const res = await request(app).get('/api/locations').set('Authorization', `Bearer ${token('user')}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ locations: [{ id: 1, name: 'Poipet' }] });
  });

  test('only the admin adds a location, and it needs a name', async () => {
    signedIn('user');
    expect((await request(app).post('/api/locations').set('Authorization', `Bearer ${token('user')}`).send({ name: 'Sisophon' })).status).toBe(403);
    signedIn('admin');
    expect((await request(app).post('/api/locations').set('Authorization', `Bearer ${token('admin')}`).send({ name: ' ' })).status).toBe(400);
    signedIn('admin', [{ id: 3, name: 'Sisophon', is_active: true }]);
    const res = await request(app).post('/api/locations').set('Authorization', `Bearer ${token('admin')}`).send({ name: ' Sisophon ' });
    expect(res.status).toBe(201);
    expect(db.query.mock.calls.at(-1)[1][0]).toBe('Sisophon');
  });

  test.each([
    ['post', '/api/registration'], ['put', '/api/registration/1'], ['post', '/api/patients'],
    ['get', '/api/patients/1/visual_acuity'], ['post', '/api/consultations/1/referrals'], ['get', '/api/users'],
  ])('the removed older endpoint %s %s is not found', async (method, url) => {
    signedIn('admin');
    expect((await request(app)[method](url).set('Authorization', `Bearer ${token('admin')}`)).status).toBe(404);
  });
});
