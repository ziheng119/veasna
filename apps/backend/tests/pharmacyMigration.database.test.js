// Opt-in integration check using only this connection's temporary tables.
// The backend runs migration 001 at every start, so it must never reset counted stock.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Pharmacy stock migration', () => {
  let client;
  const migration = fs.readFileSync(path.join(__dirname, '../migrations/001_pharmacy_numeric_stock.sql'), 'utf8');
  const stock = async () => (await client.query('SELECT stock_count FROM pharmacy ORDER BY id')).rows.map(r => r.stock_count);

  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query('SET search_path TO pg_temp');
  });
  afterAll(async () => { if (client) await client.end(); });
  afterEach(() => client.query('DROP TABLE IF EXISTS pharmacy'));

  test('restarting the backend keeps counted stock', async () => {
    await client.query(`CREATE TEMP TABLE pharmacy (id SERIAL PRIMARY KEY, drug_name TEXT,
      stock_count INT NOT NULL DEFAULT 0 CHECK (stock_count >= 0));
      INSERT INTO pharmacy (drug_name, stock_count) VALUES ('Paracetamol', 95), ('Amoxicillin', 12)`);
    await client.query(migration);
    await client.query(migration);
    expect(await stock()).toEqual([95, 12]);
  });

  test('an old stock_level database is converted once', async () => {
    await client.query(`CREATE TEMP TABLE pharmacy (id SERIAL PRIMARY KEY, drug_name TEXT, stock_level TEXT);
      INSERT INTO pharmacy (drug_name, stock_level) VALUES ('Paracetamol', 'high')`);
    await client.query(migration);
    expect(await stock()).toEqual([0]);
    await client.query('UPDATE pharmacy SET stock_count = 40');
    await client.query(migration);
    expect(await stock()).toEqual([40]);
    const { rows } = await client.query(`SELECT 1 FROM pg_attribute WHERE attrelid = 'pharmacy'::regclass AND attname = 'stock_level' AND NOT attisdropped`);
    expect(rows).toHaveLength(0);
  });
});
