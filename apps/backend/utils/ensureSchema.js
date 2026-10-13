const fs = require('fs');
const path = require('path');
const db = require('../config/db');

let ensurePharmacyNumericStockPromise = null;
let ensureVisitsCompletedPromise = null;
let ensureUserRolePromise = null;
let ensureVisitStationsPromise = null;
let ensureSnellenFractionsPromise = null;
let ensurePartialStationFormsPromise = null;
let ensureGeneratedFaceIdPromise = null;

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

function ensureUserRole() {
  if (!ensureUserRolePromise) {
    ensureUserRolePromise = runMigration('003_users_role.sql').catch((err) => {
      ensureUserRolePromise = null;
      throw err;
    });
  }
  return ensureUserRolePromise;
}

// Depends on visits.completed_at, so it runs after ensureVisitsCompleted.
function ensureVisitStations() {
  if (!ensureVisitStationsPromise) {
    ensureVisitStationsPromise = ensureVisitsCompleted()
      .then(() => runMigration('004_visit_stations.sql'))
      .catch((err) => {
        ensureVisitStationsPromise = null;
        throw err;
      });
  }
  return ensureVisitStationsPromise;
}

function ensureSnellenFractions() {
  if (!ensureSnellenFractionsPromise) {
    ensureSnellenFractionsPromise = runMigration('005_snellen_fractions.sql').catch((err) => {
      ensureSnellenFractionsPromise = null;
      throw err;
    });
  }
  return ensureSnellenFractionsPromise;
}

// Runs after the Snellen conversion so both alter the acuity columns in a fixed order.
function ensurePartialStationForms() {
  if (!ensurePartialStationFormsPromise) {
    ensurePartialStationFormsPromise = ensureSnellenFractions()
      .then(() => runMigration('006_partial_station_forms.sql'))
      .catch((err) => {
        ensurePartialStationFormsPromise = null;
        throw err;
      });
  }
  return ensurePartialStationFormsPromise;
}

function ensureGeneratedFaceId() {
  if (!ensureGeneratedFaceIdPromise) {
    ensureGeneratedFaceIdPromise = runMigration('007_generated_face_id.sql').catch((err) => {
      ensureGeneratedFaceIdPromise = null;
      throw err;
    });
  }
  return ensureGeneratedFaceIdPromise;
}

module.exports = {
  ensurePharmacyNumericStock,
  ensureVisitsCompleted,
  ensureUserRole,
  ensureVisitStations,
  ensureSnellenFractions,
  ensurePartialStationForms,
  ensureGeneratedFaceId,
};
