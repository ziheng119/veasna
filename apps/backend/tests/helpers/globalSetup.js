// Runs once before the whole suite.
// Rebuilds the test database schema from db_setup.sql and seeds the rows the
// tests assume exist (a user for `last_updated_by`, and the demo locations).

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { applyTestEnv } = require('./testEnv');

const BACKEND_ROOT = path.join(__dirname, '..', '..');

module.exports = async () => {
  applyTestEnv();

  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Cannot connect to test database "${process.env.DB_NAME}".\n` +
        `Create it once with:\n` +
        `  createdb ${process.env.DB_NAME}\n` +
        `  psql -d ${process.env.DB_NAME} -f apps/backend/db_setup.sql\n` +
        `(then the suite keeps it in sync on each run)\n\n` +
        `Original error: ${err.message}`
    );
  }

  try {
    // db_setup.sql drops and recreates every table — safe here because the
    // testEnv guard guarantees this is a throwaway database.
    const schema = fs.readFileSync(path.join(BACKEND_ROOT, 'db_setup.sql'), 'utf8');
    await client.query(schema);

    await client.query(
      `INSERT INTO users (username, password_hash, is_active)
       VALUES ('test_seed_user', NULL, TRUE)
       ON CONFLICT ((LOWER(username))) DO NOTHING`
    );

    await client.query(
      `INSERT INTO locations (name, is_active)
       VALUES ('Poipet', TRUE), ('Mongkol Borey', TRUE), ('Sisophon', TRUE)
       ON CONFLICT (name) DO NOTHING`
    );
  } finally {
    await client.end();
  }
};
