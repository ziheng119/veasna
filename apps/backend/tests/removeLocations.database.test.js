// Migration 027: one clinic, no locations. Real PostgreSQL temp tables: run with RUN_DB_TESTS=1 and
// apps/backend/.env.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('removing locations (migration 027)', () => {
  let client;
  const migrate = () => client.query(fs.readFileSync(path.join(__dirname, '../migrations/027_remove_locations.sql'), 'utf8'));
  const rows = async sql => (await client.query(sql)).rows;

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE locations (id INT PRIMARY KEY, name TEXT);
      INSERT INTO locations VALUES (1, 'North'), (2, 'South');
      CREATE TEMP TABLE patients (id INT PRIMARY KEY, location_id INT, family TEXT, last_updated_at TIMESTAMP);
      -- Family A at both places; B only at South. South's A must not join North's.
      INSERT INTO patients VALUES (1, 1, 'A', NULL), (2, 1, 'A', NULL), (3, 2, 'A', NULL), (4, 2, 'A', NULL),
        (5, 2, 'B', NULL), (6, 2, 'B', NULL), (7, 1, NULL, NULL);
      CREATE TEMP TABLE visits (id INT PRIMARY KEY, patient_id INT, location_id INT, visit_date DATE, queue_no TEXT);
      -- Both places issued number 1 on 2026-11-11.
      INSERT INTO visits VALUES (1, 1, 1, '2026-11-10', '1'), (2, 1, 1, '2026-11-11', '1'), (3, 3, 2, '2026-11-11', '1');
      CREATE TEMP TABLE pharmacy (id INT PRIMARY KEY, location_id INT, drug_name TEXT, stock_count INT, last_updated_at TIMESTAMP,
        UNIQUE (location_id, drug_name));
      INSERT INTO pharmacy VALUES (1, 1, 'Paracetamol', 10, NULL), (2, 2, 'Paracetamol', 5, NULL), (3, 2, 'Ibuprofen', 3, NULL);
      CREATE TEMP TABLE prescriptions (id INT PRIMARY KEY, drug_id INT REFERENCES pharmacy(id));
      INSERT INTO prescriptions VALUES (1, 2), (2, 3);
      CREATE TEMP TABLE pharmacy_dispenses (id INT PRIMARY KEY, drug_id INT REFERENCES pharmacy(id));
      INSERT INTO pharmacy_dispenses VALUES (1, 2);`);
    await migrate();
  });
  afterAll(async () => { if (client) await client.end(); });

  test('every location column and the locations table are gone', async () => {
    expect(await rows(`SELECT table_name FROM information_schema.columns
      WHERE table_schema LIKE 'pg_temp%' AND column_name = 'location_id'`)).toEqual([]);
    expect((await rows("SELECT to_regclass('pg_temp.locations') AS t"))[0].t).toBeNull();
  });

  test('a drug kept at two places becomes one, holding both stocks, and its prescriptions follow it', async () => {
    expect(await rows('SELECT id, drug_name, stock_count FROM pharmacy ORDER BY id')).toEqual([
      { id: 1, drug_name: 'Paracetamol', stock_count: 15 }, { id: 3, drug_name: 'Ibuprofen', stock_count: 3 },
    ]);
    expect(await rows('SELECT id, drug_id FROM prescriptions ORDER BY id')).toEqual([{ id: 1, drug_id: 1 }, { id: 2, drug_id: 3 }]);
    expect(await rows('SELECT drug_id FROM pharmacy_dispenses')).toEqual([{ drug_id: 1 }]);
    await expect(client.query("INSERT INTO pharmacy VALUES (9, 'Paracetamol', 1, NULL)")).rejects.toMatchObject({ code: '23505' });
  });

  test('families that shared a letter at different places stay apart', async () => {
    const families = Object.fromEntries((await rows('SELECT id, family FROM patients')).map(p => [p.id, p.family]));
    expect(families).toEqual({ 1: 'A', 2: 'A', 3: 'C', 4: 'C', 5: 'B', 6: 'B', 7: null });
  });

  test('a repeated queue number is refused from the day after the last day that already has one', async () => {
    await expect(client.query("INSERT INTO visits VALUES (4, 4, '2026-11-12', '5a'), (5, 5, '2026-11-12', '5A')"))
      .rejects.toMatchObject({ code: '23505' });
    // Earlier days keep what they had.
    await client.query("INSERT INTO visits VALUES (6, 6, '2026-11-11', '1')");
  });

  test('running it again changes nothing', async () => {
    await migrate();
    expect(await rows('SELECT id, stock_count FROM pharmacy ORDER BY id')).toEqual([{ id: 1, stock_count: 15 }, { id: 3, stock_count: 3 }]);
  });
});
