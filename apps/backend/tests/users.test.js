// tests/users.test.js

const request = require('supertest');
const app = require('../server');

describe('Public Users API', () => {
  test('POST /api/users creates username-only user without token', async () => {
    const uname = 'testuser_' + Math.random().toString(36).slice(2,8);
    const res = await request(app)
      .post('/api/users')
      .send({ username: uname });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe(uname);
  });

  test('GET /api/users lists users (public)', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
