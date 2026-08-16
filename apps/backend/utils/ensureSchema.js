const fs = require('fs');
const path = require('path');
const db = require('../config/db');

let ensurePharmacyNumericStockPromise = null;

function ensurePharmacyNumericStock() {
  if (!ensurePharmacyNumericStockPromise) {
    const sqlPath = path.join(__dirname, '../migrations/001_pharmacy_numeric_stock.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    ensurePharmacyNumericStockPromise = db.query(sql).catch((err) => {
      ensurePharmacyNumericStockPromise = null;
      throw err;
    });
  }
  return ensurePharmacyNumericStockPromise;
}

module.exports = {
  ensurePharmacyNumericStock,
};
