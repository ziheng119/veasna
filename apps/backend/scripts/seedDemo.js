require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function seedDemoData() {
  const sqlPath = path.join(__dirname, 'seed_demo.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await db.query(sql);

  const summary = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM locations) AS locations,
      (SELECT COUNT(*)::int FROM patients) AS patients,
      (SELECT COUNT(*)::int FROM visits WHERE visit_date = CURRENT_DATE) AS todays_visits,
      (SELECT COUNT(*)::int FROM pharmacy) AS pharmacy_items
  `);

  return summary.rows[0];
}

if (require.main === module) {
  seedDemoData()
    .then((counts) => {
      console.log('Demo data ready:');
      console.log(`  Locations: ${counts.locations}`);
      console.log(`  Patients: ${counts.patients}`);
      console.log(`  Today's visits: ${counts.todays_visits}`);
      console.log(`  Pharmacy items: ${counts.pharmacy_items}`);
    })
    .catch((error) => {
      console.error('Failed to seed demo data:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.pool.end();
    });
}

module.exports = {
  seedDemoData,
};
