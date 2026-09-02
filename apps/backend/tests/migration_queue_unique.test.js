// tests/migration_queue_unique.test.js
//
// 003_queue_number_unique.sql must fail loudly (not silently skip) when active
// visits already share a queue number, so we never ship without the constraint.

const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', 'migrations', '003_queue_number_unique.sql'),
  'utf8'
);
const INDEX = 'visits_active_queue_no_unique';

async function seedPatientAndUser() {
  const u = await db.query(
    `INSERT INTO users (username, is_active) VALUES ($1, TRUE) RETURNING id`,
    [`mig_user_${Date.now()}`]
  );
  const userId = u.rows[0].id;
  const loc = await db.query(`SELECT id FROM locations LIMIT 1`);
  const p = await db.query(
    `INSERT INTO patients (location_id, english_name, last_updated_by)
     VALUES ($1, 'Migration Test', $2) RETURNING id`,
    [loc.rows[0].id, userId]
  );
  return { userId, locationId: loc.rows[0].id, patientId: p.rows[0].id };
}

describe('migration 003 (queue number uniqueness)', () => {
  afterEach(async () => {
    // Always leave the shared schema with the index in place for other suites.
    await db.query(MIGRATION).catch(() => {});
  });

  test('re-running against a clean schema is a no-op', async () => {
    await expect(db.query(MIGRATION)).resolves.toBeDefined();
  });

  test('raises a descriptive error when active visits collide', async () => {
    const { userId, locationId, patientId } = await seedPatientAndUser();
    await db.query(`DROP INDEX IF EXISTS ${INDEX}`);

    await db.query(
      `INSERT INTO visits (patient_id, location_id, queue_no, visit_date, last_updated_by)
       VALUES ($1,$2,'DUP1',CURRENT_DATE,$3), ($1,$2,'DUP1',CURRENT_DATE,$3)`,
      [patientId, locationId, userId]
    );

    await expect(db.query(MIGRATION)).rejects.toThrow(/DUP1/);

    // cleanup so afterEach can recreate the index
    await db.query(`DELETE FROM visits WHERE patient_id = $1`, [patientId]);
    await db.query(`DELETE FROM patients WHERE id = $1`, [patientId]);
    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
});
