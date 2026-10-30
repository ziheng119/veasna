// Opt-in PostgreSQL verification. All tables live only in this connection's pg_temp
// schema; closing it removes them. No clinic tables or records are touched.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');
const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDatabase('Station routing against PostgreSQL temporary tables', () => {
  let client, app, previousSecret;
  const secret = 'temporary-station-routing-tests';
  const token = jwt.sign({ id: 1, role: 'user' }, secret, { expiresIn: '1h' });
  const original = [
    { station: 'triage', completed: true },
    { station: 'seva', completed: false },
    { station: 'consultation', completed: false },
  ];
  const save = (stations, expected = original) => request(app).put('/api/queue/1/stations')
    .set('Authorization', `Bearer ${token}`).send({ stations, ordered: true, expected_stations: expected });
  const pending = async () => (await client.query('SELECT station FROM visit_stations WHERE visit_id=1 AND completed_at IS NULL ORDER BY position')).rows.map(r => r.station);

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query('SET search_path TO pg_temp');
    await client.query(`
      CREATE TEMP TABLE users (id INT PRIMARY KEY);
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, english_name TEXT, khmer_name TEXT, sex TEXT, date_of_birth DATE);
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, completed_at TIMESTAMP, last_updated_by INT, last_updated_at TIMESTAMP DEFAULT NOW(),
        patient_id INT DEFAULT 1, location_id INT DEFAULT 1, visit_date DATE DEFAULT CURRENT_DATE, queue_no TEXT DEFAULT '1', created_at TIMESTAMP DEFAULT NOW());
      CREATE TEMP TABLE visit_stations (
        id SERIAL PRIMARY KEY, visit_id INT REFERENCES visits(id), station TEXT, position INT,
        entered_at TIMESTAMP, completed_at TIMESTAMP, last_updated_by INT,
        last_updated_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW(), UNIQUE(visit_id, station)
      );
      CREATE TEMP TABLE tb_screening (
        visit_id INT PRIMARY KEY, red_flags TEXT[], flag_notes TEXT, status TEXT, flagged_by INT,
        reviewed_by INT, reviewed_at TIMESTAMP, last_updated_by INT, last_updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/010_station_route_history.sql'), 'utf8');
    await client.query(migration.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'));
    db.query.mockImplementation((...args) => client.query(...args));
    db.pool.connect.mockResolvedValue({ query: (...args) => client.query(...args), release: () => {} });
    app = express(); app.use(express.json()); app.use('/api/queue', require('../routes/queue'));
  });
  beforeEach(async () => {
    await client.query(`TRUNCATE pg_temp.visit_station_route_history, pg_temp.visit_stations, pg_temp.visits, pg_temp.users, pg_temp.tb_screening, pg_temp.patients RESTART IDENTITY CASCADE;
      INSERT INTO patients VALUES (1, 'Test', '', 'F', '2000-01-01');
      INSERT INTO users VALUES (1); INSERT INTO visits (id) VALUES (1);
      INSERT INTO visit_stations (visit_id, station, position, entered_at, completed_at, last_updated_by) VALUES
        (1,'triage',1,'2026-10-20 08:00','2026-10-20 08:10',1),
        (1,'seva',2,'2026-10-20 08:10',NULL,1),
        (1,'consultation',3,NULL,NULL,1);`);
  });
  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  test('Home uses clinic arrival; station queues use station arrival and display that same time', async () => {
    await client.query(`UPDATE visits SET created_at='2026-10-20 08:00', visit_date='2026-10-20', queue_no='1' WHERE id=1;
      UPDATE visit_stations SET entered_at='2026-10-20 10:00' WHERE station='seva';
      INSERT INTO visits (id, created_at, visit_date, queue_no) VALUES (2, '2026-10-20 09:00', '2026-10-20', '99');
      INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by) VALUES (2,'seva',1,'2026-10-20 09:00',1);`);
    const get = station => request(app).get('/api/queue').query({ location_id: 1, date: '2026-10-20', ...(station ? { station } : {}) })
      .set('Authorization', `Bearer ${token}`);
    const home = await get(); const station = await get('seva');
    expect(home.status).toBe(200); expect(station.status).toBe(200);
    expect(home.body.map(p => p.visit_id)).toEqual([1, 2]);
    expect(station.body.map(p => p.visit_id)).toEqual([2, 1]);
    expect(station.body[1].station_arrival_time).toBe('10:00 AM');
    expect(station.body[1].timestamp).toBe('08:00 AM');
    await client.query("UPDATE visit_stations SET entered_at='2026-10-20 10:00' WHERE station='seva'");
    expect((await get('seva')).body.map(p => p.visit_id)).toEqual([1, 2]);
    await client.query("UPDATE visit_stations SET entered_at=NULL WHERE visit_id=1 AND station='seva'");
    const fallback = await get('seva');
    expect(fallback.body[0].station_arrival_time).toBe('08:00 AM');
  });

  test('return to a completed station, retain its history, then resume the route', async () => {
    const response = await save(['triage', 'seva', 'consultation']);
    expect(response.status).toBe(200);
    expect(await pending()).toEqual(['triage', 'seva', 'consultation']);
    const audit = (await client.query('SELECT * FROM visit_station_route_history')).rows[0];
    expect(audit.previous_stations[0].completed_at).toBeTruthy();
    expect(audit.last_updated_by).toBe(1);
    const finish = await request(app).post('/api/queue/1/stations/triage/complete').set('Authorization', `Bearer ${token}`);
    expect(finish.status).toBe(200); expect(finish.body.next_station).toBe('seva');
  });
  test('skip Seva, finish Consult, then return to still-pending Seva', async () => {
    expect((await save(['consultation', 'seva'])).status).toBe(200);
    const deferred = (await client.query("SELECT * FROM visit_stations WHERE station='seva'")).rows[0];
    expect(deferred.completed_at).toBeNull(); expect(deferred.entered_at).toBeNull();
    const finish = await request(app).post('/api/queue/1/stations/consultation/complete').set('Authorization', `Bearer ${token}`);
    expect(finish.body.next_station).toBe('seva');
    expect((await client.query("SELECT entered_at FROM visit_stations WHERE station='seva'")).rows[0].entered_at).not.toBeNull();
  });
  test('a stale second user cannot overwrite a changed route', async () => {
    expect((await save(['consultation', 'seva'])).status).toBe(200);
    expect((await save(['triage', 'seva'])).status).toBe(409);
    expect(await pending()).toEqual(['consultation', 'seva']);
    expect((await client.query('SELECT * FROM visit_station_route_history')).rows).toHaveLength(1);
  });
  test('editing later stops preserves the current station arrival', async () => {
    const before = (await client.query("SELECT entered_at FROM visit_stations WHERE station='seva'")).rows[0].entered_at;
    expect((await save(['seva', 'physiotherapy', 'consultation'])).status).toBe(200);
    const after = (await client.query("SELECT entered_at FROM visit_stations WHERE station='seva'")).rows[0].entered_at;
    expect(after).toEqual(before);
  });
  test('an audit failure rolls back the entire edit', async () => {
    await client.query('ALTER TABLE pg_temp.visit_station_route_history ADD CONSTRAINT reject_test_write CHECK (false) NOT VALID');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await save(['consultation', 'seva'])).status).toBe(500);
      expect(await pending()).toEqual(['seva', 'consultation']);
      expect((await client.query('SELECT * FROM visit_station_route_history')).rows).toHaveLength(0);
    } finally {
      log.mockRestore();
      await client.query('ALTER TABLE pg_temp.visit_station_route_history DROP CONSTRAINT reject_test_write');
    }
  });
  test('completed visits cannot be reopened by route editing', async () => {
    await client.query('UPDATE visits SET completed_at=NOW() WHERE id=1');
    expect((await save(['triage'])).status).toBe(409);
    expect((await client.query('SELECT * FROM visit_station_route_history')).rows).toHaveLength(0);
  });
  test('TB is not a station: routes containing it are rejected unchanged', async () => {
    expect((await save(['tb', 'seva', 'consultation'])).status).toBe(400);
    expect(await pending()).toEqual(['seva', 'consultation']);
  });
});
