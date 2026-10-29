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
  const token = jwt.sign({ id: 1, role: 'admin' }, secret);
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
      CREATE TEMP TABLE consultation (id SERIAL, visit_id INT UNIQUE, notes TEXT, condition_categories TEXT[], prescription TEXT, require_referral BOOLEAN, last_updated_by INT, last_updated_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW());
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
  test('unchanged signature preserves original signer; edited and cleared signatures persist', async () => {
    await client.query("INSERT INTO users VALUES (2,'Clinician Two')");
    const signature = [[[0, 0], [1, 1]]];
    const original = await save({ ...draft, signature });
    const secondToken = jwt.sign({ id: 2, role: 'admin' }, secret);
    const edit = data => request(app).post('/referral/1').set('Authorization', `Bearer ${secondToken}`).send({ ...draft, ...data });
    const unchanged = await edit({ reason: 'Changed text', signature });
    expect(unchanged.body).toMatchObject({ signature, signer_id: 1, signer_name: 'Clinician One', signed_at: original.body.signed_at, last_updated_by: 2 });
    const changed = [[[0.1, 0.2], [0.5, 0.6]]];
    expect((await edit({ signature: changed })).body).toMatchObject({ signature: changed, signer_id: 2, signer_name: 'Clinician Two' });
    expect((await get()).body.signature).toEqual(changed);
    expect((await edit({ signature: null })).body).toMatchObject({ signature: null, signer_id: null, signer_name: null, signed_at: null });
  });
  test('deletes only the selected visit, preserves notes, clears flag and supports recreation', async () => {
    await client.query("INSERT INTO visits VALUES (2); INSERT INTO referral (visit_id, referral_type, illness, duration, reason, last_updated_by) VALUES (2,'Dentist','','','Other patient',1)");
    await save(draft);
    const notes = await request(app).post('/consultation/1').set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Keep notes', prescription: 'Keep prescription', require_referral: false });
    expect(notes.status).toBe(200);
    expect(notes.body.require_referral).toBe(true); // Derived from the saved record.
    const before = await get();
    const remove = () => request(app).delete('/referral/1').set('Authorization', `Bearer ${token}`);
    expect((await request(app).delete('/referral/1')).status).toBe(401);
    expect((await request(app).delete('/referral/invalid').set('Authorization', `Bearer ${token}`)).status).toBe(400);
    await client.query("INSERT INTO visit_stations VALUES (1,'tb',NULL)");
    expect((await remove()).status).toBe(409);
    await client.query("DELETE FROM visit_stations");
    expect((await remove()).status).toBe(204);
    const after = await get().set('If-None-Match', before.headers.etag);
    expect(after.status).toBe(200);
    expect(after.body).toMatchObject({ notes: 'Keep notes', prescription: 'Keep prescription', require_referral: false, referral_type: null, last_updated_by: 1 });
    expect((await client.query('SELECT visit_id FROM referral')).rows).toEqual([{ visit_id: 2 }]);
    expect((await remove()).status).toBe(204);
    expect((await save(draft)).status).toBe(200);
    expect((await get()).body.require_referral).toBe(true);
  });
  test('user first save is allowed, concurrent overwrite is denied without changing referral metadata', async () => {
    await client.query('INSERT INTO visits (id) VALUES (50)');
    const userToken = jwt.sign({ id: 1, role: 'user' }, secret);
    const submit = reason => request(app).post('/referral/50').set('Authorization', `Bearer ${userToken}`).send({ ...draft, reason });
    const results = await Promise.all([submit('First'), submit('Other')]);
    expect(results.map(result => result.status).sort()).toEqual([200, 403]);
    const before = (await client.query('SELECT * FROM referral WHERE visit_id=50')).rows[0];
    expect((await submit('Overwrite')).status).toBe(403);
    expect((await client.query('SELECT * FROM referral WHERE visit_id=50')).rows[0]).toEqual(before);
    const notes = data => request(app).post('/consultation/50').set('Authorization', `Bearer ${userToken}`).send(data);
    expect((await notes({ notes: 'Initial notes' })).status).toBe(200);
    expect((await notes({ notes: 'Changed notes' })).status).toBe(403);
    expect((await client.query('SELECT notes FROM consultation WHERE visit_id=50')).rows[0].notes).toBe('Initial notes');
    expect((await request(app).post('/referral/50').set('Authorization', `Bearer ${token}`).send({ ...draft, reason: 'Admin edit' })).status).toBe(200);
    await client.query('DELETE FROM referral WHERE visit_id=50');
    await client.query('DELETE FROM consultation WHERE visit_id=50');
    await client.query('DELETE FROM visits WHERE id=50');
  });
  test('daily batch filters location/date, includes completed and undated drafts, and validates input', async () => {
    await client.query(`
      ALTER TABLE visits ADD COLUMN location_id INT DEFAULT 1, ADD COLUMN patient_id INT DEFAULT 1,
        ADD COLUMN visit_date DATE DEFAULT '2026-10-20', ADD COLUMN created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN completed_at TIMESTAMP;
      CREATE TEMP TABLE patients (id INT, english_name TEXT, khmer_name TEXT, sex TEXT, address TEXT, date_of_birth DATE);
      INSERT INTO patients VALUES (1,'Patient','','F','Address','2000-01-01');
      UPDATE visits SET completed_at=NOW() WHERE id=1;
      UPDATE visits SET location_id=2 WHERE id=2;
      INSERT INTO visits (id) VALUES (3),(4),(5);
      UPDATE visits SET visit_date='2026-10-19' WHERE id=4;
      INSERT INTO referral (visit_id, referral_type, illness, duration, reason, last_updated_by) VALUES
        (3,'Dentist','','','Undated draft',1), (4,'Dentist','','','Yesterday',1);
    `);
    const daily = (query) => request(app).get('/referrals').set('Authorization', `Bearer ${token}`).query(query);
    const response = await daily({ location_id: 1, date: '2026-10-20' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.map(row => row.visit_id)).toEqual([1, 3]);
    expect(response.body[0]).toMatchObject({ patient_id: 1, date_of_birth: '2000-01-01', referral_date: '2026-10-20' });
    expect(response.body[1].signature).toBeNull();
    expect((await daily({ location_id: 1, date: '2026-10-22' })).body).toEqual([]);
    for (const query of [{}, { location_id: -1, date: '2026-10-20' }, { location_id: 1, date: '2026-02-30' }]) {
      expect((await daily(query)).status).toBe(400);
    }
    expect((await request(app).get('/referrals').query({ location_id: 1, date: '2026-10-20' })).status).toBe(401);
  });
  test('condition selections persist, reject invalid input, obey saved-record permissions and preserve labels for older clients', async () => {
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/015_consultation_conditions.sql'), 'utf8');
    await client.query(migration); await client.query(migration);
    await client.query('INSERT INTO visits (id) VALUES (51)');
    const userToken = jwt.sign({id:1,role:'user'},secret);
    const saveNotes = (auth,body) => request(app).post('/consultation/51').set('Authorization','Bearer '+auth).send(body);
    expect((await saveNotes(userToken,{notes:'Initial',condition_categories:['diabetes','hypertension']})).status).toBe(200);
    expect((await request(app).get('/consultation/51').set('Authorization','Bearer '+token)).body.condition_categories).toEqual(['diabetes','hypertension']);
    expect((await saveNotes(userToken,{condition_categories:['skin']})).status).toBe(403);
    expect((await saveNotes(token,{notes:'Older client'})).body.condition_categories).toEqual(['diabetes','hypertension']);
    for (const value of ['diabetes',['unknown'],['diabetes','diabetes'],[null],{}]) {
      expect((await saveNotes(token,{condition_categories:value})).status).toBe(400);
    }
    expect((await saveNotes(token,{condition_categories:[]})).body.condition_categories).toEqual([]);
    expect((await saveNotes(token,{condition_categories:null})).body.condition_categories).toBeNull();
  });

});
