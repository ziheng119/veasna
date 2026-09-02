// tests/auth.test.js

const { app, request, registerAndLogin } = require('./helpers/api');

describe('Auth', () => {
  test('POST /api/auth/register is public and returns a token', async () => {
    const username = `reg_${Date.now()}`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'a-good-password' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.username).toBe(username);
  });

  test('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `short_${Date.now()}`, password: 'short' });

    expect(res.status).toBe(400);
  });

  test('rejects a duplicate username', async () => {
    const { username } = await registerAndLogin();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'another-password' });

    expect(res.status).toBe(409);
  });

  test('login succeeds with correct credentials and fails with wrong ones', async () => {
    const { username, password } = await registerAndLogin();

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });
});
