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

  test('deactivate then reactivate a user', async () => {
    const { token } = await registerAndLogin();
    const username = `toggle_${Date.now()}`;
    await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({ username });

    const off = await request(app)
      .patch('/api/users/deactivate')
      .set('Authorization', `Bearer ${token}`)
      .send({ username });
    expect(off.status).toBe(200);
    expect(off.body.user.is_active).toBe(false);

    // it drops out of the active roster
    const roster = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(roster.body.some((u) => u.username === username)).toBe(false);

    // POST again reactivates
    const back = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username });
    expect(back.status).toBe(200);
    expect(back.body.user.is_active).toBe(true);
  });
});
