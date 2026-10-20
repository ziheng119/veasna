const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({
  query: jest.fn(),
  hashPassword: password => require('bcrypt').hash(password, 4),
  comparePassword: (password, hash) => require('bcrypt').compare(password, hash),
}));
const db = require('../config/db');
const { seedStationUsers, STATION_ACCOUNTS } = require('../scripts/seedStationUsers');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Station accounts and authorization gateway', () => {
  let client, app, oldSecret;
  const secret = 'station-accounts-test';
  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id SERIAL PRIMARY KEY, username TEXT NOT NULL, password_hash TEXT, role VARCHAR(20) DEFAULT 'user', is_active BOOLEAN DEFAULT TRUE);
      CREATE UNIQUE INDEX test_username ON users (LOWER(username));`);
    db.query.mockImplementation((...args) => client.query(...args));
    app = express(); app.use(express.json());
    app.use(require('../middleware/authorizeApi').authorizeApi);
    app.use('/auth', require('../routes/session'));
    // Re-run route authentication to verify it cannot overwrite the fresh database role.
    app.use(require('../routes/auth').authenticateToken);
    app.all('*', (req, res) => res.json({ role: req.user.role }));
  });
  afterAll(async () => {
    if (client) await client.end();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  });
  test('creates all starter accounts, hashes matching passwords, and preserves existing accounts', async () => {
    expect((await seedStationUsers()).every(account => account.created)).toBe(true);
    for (const [username, role] of STATION_ACCOUNTS) {
      const account = (await client.query('SELECT * FROM users WHERE username=$1', [username])).rows[0];
      expect(account.role).toBe(role);
      expect(account.password_hash).not.toBe(username);
      expect(await bcrypt.compare(username, account.password_hash)).toBe(true);
      const login = await request(app).post('/auth/login').send({ username, password: username });
      expect(login.status).toBe(200);
      expect(login.body.user.role).toBe(role);
    }
    const before = (await client.query("SELECT password_hash FROM users WHERE username='triage_doctor'")).rows[0].password_hash;
    await client.query("UPDATE users SET is_active=FALSE WHERE username='triage_doctor'");
    expect((await seedStationUsers()).every(account => !account.created)).toBe(true);
    const after = (await client.query("SELECT * FROM users WHERE username='triage_doctor'")).rows[0];
    expect(after.password_hash).toBe(before); expect(after.is_active).toBe(false);
    await client.query("UPDATE users SET is_active=TRUE WHERE username='triage_doctor'");
  });
  test('rejects unauthenticated/cross-station actions and refreshes stale token roles', async () => {
    const login = await request(app).post('/auth/login').send({ username: 'triage_doctor', password: 'triage_doctor' });
    const token = login.body.token;
    expect((await request(app).get('/queue')).status).toBe(401);
    expect((await request(app).post('/triage/history').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await request(app).post('/visits/consultation/1').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    const forgedRole = jwt.sign({ id: login.body.user.id, role: 'admin' }, secret);
    expect((await request(app).get('/analytics').set('Authorization', `Bearer ${forgedRole}`)).status).toBe(403);
    await client.query("UPDATE users SET role='seva' WHERE username='triage_doctor'");
    const profile = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(profile.body.role).toBe('seva');
    expect((await request(app).post('/triage/history').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).post('/visits/seva/1').set('Authorization', `Bearer ${token}`)).body.role).toBe('seva');
    await client.query("UPDATE users SET is_active=FALSE WHERE username='triage_doctor'");
    expect((await request(app).get('/queue').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });
  test('only admin can register a selected valid role', async () => {
    const login = await request(app).post('/auth/login').send({ username: 'clinic_admin', password: 'clinic_admin' });
    const create = data => request(app).post('/auth/register').set('Authorization', `Bearer ${login.body.token}`).send(data);
    expect((await create({ username: 'test_clinician', password: 'test_clinician', role: 'invalid' })).status).toBe(400);
    const created = await create({ username: 'test_clinician', password: 'test_clinician', role: 'consultation' });
    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe('consultation');
    expect((await request(app).post('/auth/register').set('Authorization', `Bearer ${created.body.token}`)
      .send({ username: 'escalated_admin', password: 'escalated_admin', role: 'admin' })).status).toBe(403);
  });
});
