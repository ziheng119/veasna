// Opt-in integration checks use only this connection's temporary tables.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn() }));
const db = require('../config/db');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Referral persistence', () => {
  let client, app, previousSecret;
  const secret = 'referral-test-secret';
  const token = jwt.sign({ id: 1, role: 'user' }, secret);
  const get = () => request(app).get('/consultation/1').set('Authorization', `Bearer ${token}`);
  const save = data => request(app).post('/referral/1').set('Authorization', `Bearer ${token}`).send(data);
  const draft = { referralType: 'Dentist\n', reason: 'Assessment', illness: '', duration: '', referralDate: '2026-10-20' };
  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id INT PRIMARY KEY, username TEXT);
      INSERT INTO users VALUES (1,'Clinician One');
      CREATE TEMP TABLE visits (id INT PRIMARY KEY);
      INSERT INTO visits VALUES (1);
      CREATE TEMP TABLE visit_stations (visit_id INT, station TEXT, completed_at TIMESTAMP);
      CREATE TEMP TABLE consultation (id SERIAL, visit_id INT, notes TEXT, prescription TEXT, require_referral BOOLEAN, last_updated_by INT, last_updated_at TIMESTAMP, created_at TIMESTAMP);
    `);
    const setup = fs.readFileSync(path.join(__dirname, '../db_setup.sql'), 'utf8');
    // Start with the old schema to exercise upgrading existing installations.
    const table = setup.match(/CREATE TABLE referral \([\s\S]*?\n\);/)[0]
      .replace(/^    (signature JSONB|signer_id INTEGER REFERENCES users\(id\)|signer_name TEXT|signed_at TIMESTAMPTZ),\r?\n/gm, '');
    await client.query(table.replace('CREATE TABLE', 'CREATE TEMP TABLE'));
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/011_referral_signature.sql'), 'utf8');
    await client.query(migration);
    await client.query(migration); // Idempotence.
    db.query.mockImplementation((...args) => client.query(...args));
    app = express(); app.use(express.json()); app.use(require('../routes/visits'));
  });
  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  test('saves before consultation, derives signer on server, reloads and invalidates ETag', async () => {
    const signature = [[[0, 0], [1, 1]]];
    const saved = await save({ ...draft, signature, signerName: 'Forged name', signerId: 999 });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ signature, signer_name: 'Clinician One', signer_id: 1, last_updated_by: 1 });
    expect(saved.body.signed_at).toBeTruthy();
    const loaded = await get();
    expect(loaded.body.signature).toEqual(signature);
    expect(loaded.body.referral_type).toBe('Dentist\n');
    const unchanged = await get().set('If-None-Match', loaded.headers.etag);
    expect(unchanged.status).toBe(304);
    expect((await save({ ...draft, reason: 'Updated', signature: null })).status).toBe(200);
    const updated = await get().set('If-None-Match', loaded.headers.etag);
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ reason: 'Updated', signature: null, signer_name: null, signer_id: null, signed_at: null });
  });
  test('rejects invalid signatures and unauthenticated requests', async () => {
    expect((await save({ ...draft, signature: '<svg/>' })).status).toBe(400);
    expect((await request(app).post('/referral/1').send(draft)).status).toBe(401);
  });
});
