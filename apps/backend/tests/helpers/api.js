// Shared helpers for API tests.

const request = require('supertest');
const app = require('../../server');

let seq = 0;

// Register a fresh user and return its bearer token.
async function registerAndLogin(overrides = {}) {
  seq += 1;
  const username = overrides.username || `test_user_${Date.now()}_${seq}`;
  const password = overrides.password || 'test-password-123';

  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password });

  if (res.status !== 201) {
    throw new Error(
      `registerAndLogin failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }

  return { token: res.body.token, user: res.body.user, username, password };
}

// Resolve a seeded location id by name (falls back to the first location).
async function getLocationId(token, name = 'Poipet') {
  if (!token) {
    ({ token } = await registerAndLogin());
  }
  const res = await request(app)
    .get('/api/locations')
    .set('Authorization', `Bearer ${token}`);
  const locations = res.body.locations || [];
  const match = locations.find((l) => l.name === name) || locations[0];
  if (!match) throw new Error('No locations seeded');
  return match.id;
}

module.exports = { app, request, registerAndLogin, getLocationId };
