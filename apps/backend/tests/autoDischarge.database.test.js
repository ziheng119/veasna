// Uses only connection-local temporary tables; clinic data is never modified.
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn() }));
const db = require('../config/db');
const { dischargePastVisits } = require('../utils/autoDischarge');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Auto-discharge at the end of the day', () => {
  let client;
  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE visits (id INT, visit_date DATE, completed_at TIMESTAMP, auto_discharged BOOLEAN NOT NULL DEFAULT FALSE,
        last_updated_at TIMESTAMP, last_updated_by INT);
      INSERT INTO visits (id, visit_date, completed_at, last_updated_at, last_updated_by) VALUES
        (1, '2026-10-20', NULL, '2026-10-20 15:00', 7),
        (2, '2026-10-20', '2026-10-20 16:00', '2026-10-20 16:00', 8),
        (3, '2026-10-21', NULL, '2026-10-21 09:00', 9);`);
    db.query.mockImplementation((...args) => client.query(...args));
  });
  afterAll(async () => { if (client) await client.end(); });

  test('discharges only open visits from earlier days, marked as automatic', async () => {
    expect(await dischargePastVisits('2026-10-21')).toBe(1);
    const { rows } = await client.query(`SELECT id, completed_at IS NOT NULL AS done, auto_discharged, last_updated_by,
      TO_CHAR(completed_at, 'YYYY-MM-DD HH24:MI') AS completed FROM visits ORDER BY id`);
    expect(rows).toEqual([
      expect.objectContaining({ id: 1, done: true, auto_discharged: true, last_updated_by: 7 }),
      { id: 2, done: true, auto_discharged: false, last_updated_by: 8, completed: '2026-10-20 16:00' },
      { id: 3, done: false, auto_discharged: false, last_updated_by: 9, completed: null },
    ]);
    expect(await dischargePastVisits('2026-10-21')).toBe(0);
  });
});
