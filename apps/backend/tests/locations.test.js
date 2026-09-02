// tests/locations.test.js

const { app, request, registerAndLogin } = require('./helpers/api');

describe('Locations API', () => {
  test('GET /api/locations returns the seeded active locations', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.locations)).toBe(true);
    const names = res.body.locations.map((l) => l.name);
    expect(names).toEqual(
      expect.arrayContaining(['Poipet', 'Mongkol Borey', 'Sisophon'])
    );
  });

  test('GET /api/locations requires a token', async () => {
    const res = await request(app).get('/api/locations');
    expect(res.status).toBe(401);
  });

  test('POST /api/locations creates a location for any authenticated user', async () => {
    const { token } = await registerAndLogin();
    const name = `Test Clinic ${Date.now()}`;

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name });

    expect(res.status).toBe(201);
    expect(res.body.location.name).toBe(name);

    // cleanup: soft-delete so it doesn't leak into other assertions
    await request(app)
      .delete(`/api/locations/${res.body.location.id}`)
      .set('Authorization', `Bearer ${token}`);
  });

  test('POST /api/locations requires a token', async () => {
    const res = await request(app)
      .post('/api/locations')
      .send({ name: 'No Auth Clinic' });
    expect(res.status).toBe(401);
  });
});
