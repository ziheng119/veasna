// Migration 026: visit indexes, and one queue number per location and day once the data allows it.
// Real PostgreSQL temp tables: run with RUN_DB_TESTS=1 and apps/backend/.env.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('visit indexes migration', () => {
  let client;
  const migrate = () => client.query(fs.readFileSync(path.join(__dirname, '../migrations/026_visit_indexes.sql'), 'utf8'));
  const exists = async name => (await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [`pg_temp.${name}`])).rows[0].present;

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, location_id INT);
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT, location_id INT, visit_date DATE, queue_no TEXT);
      INSERT INTO visits VALUES (1, 1, 1, '2026-11-11', '12a'), (2, 2, 1, '2026-11-11', '12A'), (3, 3, 2, '2026-11-11', '12A');`);
  });
  afterAll(async () => { if (client) await client.end(); });

  test('with duplicate numbers the lookup indexes are added but the unique rule is left out', async () => {
    await migrate();
    expect(await exists('visits_location_date_idx')).toBe(true);
    expect(await exists('visits_patient_idx')).toBe(true);
    expect(await exists('patients_location_idx')).toBe(true);
    expect(await exists('visits_queue_no_key')).toBe(false);
  });

  test('once the duplicates are fixed the database refuses a repeated number at the same place and day', async () => {
    await client.query("UPDATE visits SET queue_no = '13' WHERE id = 2");
    await migrate();
    await migrate(); // safe to run again
    expect(await exists('visits_queue_no_key')).toBe(true);
    await expect(client.query("INSERT INTO visits VALUES (4, 4, 1, '2026-11-11', '12A')")).rejects.toMatchObject({ code: '23505' });
    // Another day or location may use it.
    await client.query("INSERT INTO visits VALUES (5, 5, 1, '2026-11-12', '12A'), (6, 6, 3, '2026-11-11', '12A')");
  });
});
