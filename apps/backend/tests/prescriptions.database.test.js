// Opt-in PostgreSQL verification of prescription stock reservation. All tables live only in
// this connection's pg_temp schema; closing it removes them. No clinic records are touched.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
jest.mock('../utils/ensureSchema', () => ({
  ensurePharmacyNumericStock: jest.fn().mockResolvedValue(),
  ensurePrescriptions: jest.fn().mockResolvedValue(),
}));
const db = require('../config/db');
const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDatabase('Prescriptions reserve and release pharmacy stock', () => {
  let client, app, previousSecret;
  const secret = 'temporary-prescription-tests';
  const token = jwt.sign({ id: 1, role: 'admin' }, secret, { expiresIn: '1h' });
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const drug = async (id = 1) => (await as(request(app).get('/pharmacy?location_id=1'))).body.find(d => d.id === id);
  const prescribe = (body) => as(request(app).post('/prescriptions')).send({ visit_id: 1, drug_id: 1, ...body });

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query('SET search_path TO pg_temp');
    await client.query(`
      CREATE TEMP TABLE users (id INT PRIMARY KEY, username TEXT);
      CREATE TEMP TABLE locations (id INT PRIMARY KEY);
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, english_name TEXT, khmer_name TEXT, face_id TEXT);
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT, location_id INT, queue_no TEXT, visit_date DATE DEFAULT CURRENT_DATE);`);
    const setup = fs.readFileSync(path.join(__dirname, '../db_setup.sql'), 'utf8').replace(/\r\n/g, '\n');
    for (const table of ['pharmacy', 'prescriptions']) {
      const start = setup.indexOf(`CREATE TABLE ${table} (`);
      await client.query(setup.slice(start, setup.indexOf('\n);', start) + 3).replace('CREATE TABLE', 'CREATE TEMP TABLE'));
    }
    db.query.mockImplementation((...args) => client.query(...args));
    db.pool.connect.mockResolvedValue({ query: (...args) => client.query(...args), release() {} });
    app = express();
    app.use(express.json());
    app.use('/pharmacy', require('../routes/pharmacy'));
    app.use('/prescriptions', require('../routes/prescriptions'));
  });

  beforeEach(() => client.query(`
    TRUNCATE prescriptions, pharmacy, visits, patients, locations, users RESTART IDENTITY CASCADE;
    INSERT INTO users VALUES (1, 'doctor');
    INSERT INTO locations VALUES (1), (2);
    INSERT INTO patients VALUES (1, 'Sok', 'សុខ', 'SOK');
    INSERT INTO visits (id, patient_id, location_id, queue_no) VALUES (1, 1, 1, 'A12');
    INSERT INTO pharmacy (id, location_id, drug_name, stock_count, last_updated_by) VALUES
      (1, 1, 'Paracetamol', 10, 1), (2, 2, 'Ibuprofen', 10, 1);`));

  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  test('prescribing reserves stock at once; more than is available is refused', async () => {
    const res = await prescribe({ quantity: 6, instructions: '1 tab twice daily' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'pending', drug_name: 'Paracetamol', quantity: 6, queue_no: 'A12', english_name: 'Sok', available_count: 4 });
    expect(await drug()).toMatchObject({ stock_count: 10, reserved_count: 6, available_count: 4 });
    const tooMany = await prescribe({ quantity: 5 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.available_count).toBe(4);
    expect((await prescribe({ quantity: 0 })).status).toBe(400);
    expect((await prescribe({ drug_id: 2, quantity: 1 })).status).toBe(400); // other location's pharmacy
  });

  test('dispensing lowers stock and ends the reservation; it cannot happen twice', async () => {
    const { body } = await prescribe({ quantity: 6 });
    const dispensed = await as(request(app).post(`/prescriptions/${body.id}/dispense`));
    expect(dispensed.status).toBe(200);
    expect(dispensed.body).toMatchObject({ status: 'dispensed', dispensed_by: 'doctor' });
    expect(await drug()).toMatchObject({ stock_count: 4, reserved_count: 0, available_count: 4 });
    expect((await as(request(app).post(`/prescriptions/${body.id}/dispense`))).status).toBe(409);
    expect((await as(request(app).post(`/prescriptions/${body.id}/cancel`))).status).toBe(409);
  });

  test('cancelling releases the reservation without touching stock', async () => {
    const { body } = await prescribe({ quantity: 6 });
    const cancelled = await as(request(app).post(`/prescriptions/${body.id}/cancel`));
    expect(cancelled.body).toMatchObject({ status: 'cancelled', cancelled_by: 'doctor' });
    expect(await drug()).toMatchObject({ stock_count: 10, reserved_count: 0, available_count: 10 });
  });

  test('walk-in dispensing, stock-takes and deletion respect reserved stock', async () => {
    await prescribe({ quantity: 6 });
    expect((await as(request(app).post('/pharmacy/1/dispense')).send({ quantity: 5 })).status).toBe(409);
    expect((await as(request(app).post('/pharmacy/1/dispense')).send({ quantity: 4 })).body).toMatchObject({ stock_count: 6, available_count: 0 });
    expect((await as(request(app).patch('/pharmacy/1')).send({ stock_count: 5 })).status).toBe(409);
    expect((await as(request(app).patch('/pharmacy/1')).send({ stock_count: 8 })).body).toMatchObject({ stock_count: 8, available_count: 2 });
    expect((await as(request(app).delete('/pharmacy/1'))).status).toBe(409);
  });

  test('pharmacy lists: pending by location, patients, and one patient\'s history', async () => {
    const first = (await prescribe({ quantity: 2 })).body;
    await prescribe({ quantity: 1 });
    await as(request(app).post(`/prescriptions/${first.id}/dispense`));
    const pending = await as(request(app).get('/prescriptions?location_id=1&status=pending'));
    expect(pending.body.map(p => p.quantity)).toEqual([1]);
    const patients = await as(request(app).get('/prescriptions/patients?location_id=1'));
    expect(patients.body).toEqual([expect.objectContaining({ patient_id: 1, pending_count: 1, dispensed_count: 1, cancelled_count: 0 })]);
    const history = await as(request(app).get('/prescriptions/patient/1'));
    expect(history.body.map(p => p.status).sort()).toEqual(['dispensed', 'pending']);
    expect((await as(request(app).get('/prescriptions'))).status).toBe(400);
  });
});
