const fs = require('fs');
const path = require('path');
const db = require('../config/db');

let ensurePharmacyNumericStockPromise = null;
let ensureVisitsCompletedPromise = null;
let ensureQueueNumberUniquePromise = null;

function runMigration(fileName) {
  const sqlPath = path.join(__dirname, '../migrations', fileName);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  return db.query(sql);
}

function ensurePharmacyNumericStock() {
  if (!ensurePharmacyNumericStockPromise) {
    ensurePharmacyNumericStockPromise = runMigration('001_pharmacy_numeric_stock.sql').catch((err) => {
      ensurePharmacyNumericStockPromise = null;
      throw err;
    });
  }
  return ensurePharmacyNumericStockPromise;
}

function ensureVisitsCompleted() {
  if (!ensureVisitsCompletedPromise) {
    ensureVisitsCompletedPromise = runMigration('002_visits_completed.sql').catch((err) => {
      ensureVisitsCompletedPromise = null;
      throw err;
    });
  }
  return ensureVisitsCompletedPromise;
}

function ensureQueueNumberUnique() {
  if (!ensureQueueNumberUniquePromise) {
    ensureQueueNumberUniquePromise = runMigration('003_queue_number_unique.sql').catch((err) => {
      ensureQueueNumberUniquePromise = null;
      throw err;
    });
  }
  return ensureQueueNumberUniquePromise;
}

module.exports = {
  ensurePharmacyNumericStock,
  ensureVisitsCompleted,
  ensureQueueNumberUnique,
};
