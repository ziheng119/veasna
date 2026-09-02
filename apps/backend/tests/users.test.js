// tests/users.test.js

const { app, request, registerAndLogin } = require('./helpers/api');

describe('Users API', () => {
  test('GET /api/users lists users for an authenticated caller', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((u) => typeof u.username === 'string')).toBe(true);
  });

  test('GET /api/users requires a token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  test('POST /api/users creates a username-only user for any authenticated caller', async () => {
    const { token } = await registerAndLogin();
    const username = `roster_${Date.now()}`;

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe(username);
  });
});
