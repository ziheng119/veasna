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
let ensureSevaReferralPromise = null;
let ensureTbScreeningPromise = null;

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
    ensureUserRolePromise = runMigration('003_users_role.sql').then(() => runMigration('014_two_user_roles.sql')).catch((err) => {
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

function ensureSevaReferral() {
  if (!ensureSevaReferralPromise) {
    ensureSevaReferralPromise = runMigration('008_seva_referral.sql').catch((err) => {
      ensureSevaReferralPromise = null;
      throw err;
    });
  }
  return ensureSevaReferralPromise;
}

function ensureTbScreening() {
  if (!ensureTbScreeningPromise) {
    ensureTbScreeningPromise = ensureVisitStations()
      .then(() => runMigration('009_tb_screening.sql'))
      .catch((err) => {
        ensureTbScreeningPromise = null;
        throw err;
      });
  }
  return ensureTbScreeningPromise;
}

let ensureStationRouteHistoryPromise = null;
function ensureStationRouteHistory() {
  if (!ensureStationRouteHistoryPromise) {
    ensureStationRouteHistoryPromise = ensureVisitStations()
      .then(() => runMigration('010_station_route_history.sql'))
      .catch(err => { ensureStationRouteHistoryPromise = null; throw err; });
  }
  return ensureStationRouteHistoryPromise;
}

let referralSignaturePromise = null;
function ensureReferralSignature() {
  if (!referralSignaturePromise) {
    referralSignaturePromise = runMigration('011_referral_signature.sql')
      .catch(err => { referralSignaturePromise = null; throw err; });
  }
  return referralSignaturePromise;
}

let consultationConditionsPromise;
function ensureConsultationConditions() {
  if (!consultationConditionsPromise) consultationConditionsPromise = runMigration('015_consultation_conditions.sql')
    .catch(error => { consultationConditionsPromise = null; throw error; });
  return consultationConditionsPromise;
}

// TB becomes a flag instead of a station; the route-history table keeps an audit copy.
let tbFlagPromise = null;
function ensureTbFlag() {
  if (!tbFlagPromise) {
    tbFlagPromise = ensureTbScreening()
      .then(() => ensureStationRouteHistory())
      .then(() => runMigration('016_tb_flag.sql'))
      .catch(err => { tbFlagPromise = null; throw err; });
  }
  return tbFlagPromise;
}

let prescriptionsPromise = null;
function ensurePrescriptions() {
  if (!prescriptionsPromise) {
    prescriptionsPromise = ensurePharmacyNumericStock()
      .then(() => runMigration('017_prescriptions.sql'))
      .catch(err => { prescriptionsPromise = null; throw err; });
  }
  return prescriptionsPromise;
}

// Rewrites the station constraint after 016 did, so it runs after ensureTbFlag.
let dentalPharmacyStationsPromise = null;
function ensureDentalPharmacyStations() {
  if (!dentalPharmacyStationsPromise) {
    dentalPharmacyStationsPromise = ensureTbFlag()
      .then(() => runMigration('018_dental_pharmacy_stations.sql'))
      .catch(err => { dentalPharmacyStationsPromise = null; throw err; });
  }
  return dentalPharmacyStationsPromise;
}

let familiesPromise;
function ensureFamilies() {
  if (!familiesPromise) {
    // Needs only visits and visit_stations, so a failing earlier step can't hold it up.
    familiesPromise = ensureVisitStations()
      .then(() => runMigration('019_families.sql'))
      .catch(err => { familiesPromise = null; throw err; });
  }
  return familiesPromise;
}

// Screening-day accounts and editable form options. Needs users.role (ensureUserRole).
let dayAccountsPromise;
function ensureDayAccountsAndFormOptions() {
  if (!dayAccountsPromise) {
    dayAccountsPromise = ensureUserRole()
      .then(() => runMigration('020_day_accounts_form_options.sql'))
      .catch(err => { dayAccountsPromise = null; throw err; });
  }
  return dayAccountsPromise;
}

// "With glasses" eye readings and the registration sticker colour.
let glassesStickerPromise;
function ensureGlassesAndStickerColour() {
  if (!glassesStickerPromise) {
    glassesStickerPromise = runMigration('021_glasses_sticker_colour.sql')
      .catch(err => { glassesStickerPromise = null; throw err; });
  }
  return glassesStickerPromise;
}

// Disables the shared "user" sign-in; needs users.screening_date from 020.
let retireSharedUserPromise;
function ensureSharedUserRetired() {
  if (!retireSharedUserPromise) {
    retireSharedUserPromise = ensureDayAccountsAndFormOptions()
      .then(() => runMigration('022_retire_shared_user_account.sql'))
      .catch(err => { retireSharedUserPromise = null; throw err; });
  }
  return retireSharedUserPromise;
}

// referral.doctor_name and the one-off reset of the referral destinations list (needs form_options
// from 020).
let referralDoctorPromise;
function ensureReferralDoctor() {
  if (!referralDoctorPromise) {
    referralDoctorPromise = ensureDayAccountsAndFormOptions()
      .then(() => runMigration('023_referral_doctor_destinations.sql'))
      .catch(err => { referralDoctorPromise = null; throw err; });
  }
  return referralDoctorPromise;
}

// visits.request_id: a registration sent twice is saved once.
let registrationRequestIdPromise;
function ensureRegistrationRequestId() {
  if (!registrationRequestIdPromise) {
    registrationRequestIdPromise = runMigration('024_registration_request_id.sql')
      .catch(err => { registrationRequestIdPromise = null; throw err; });
  }
  return registrationRequestIdPromise;
}

// pharmacy_dispenses: a record of each walk-in dispense, sent once even if sent twice.
let pharmacyDispensesPromise;
function ensurePharmacyDispenses() {
  if (!pharmacyDispensesPromise) {
    pharmacyDispensesPromise = runMigration('025_pharmacy_dispenses.sql')
      .catch(err => { pharmacyDispensesPromise = null; throw err; });
  }
  return pharmacyDispensesPromise;
}

// Visit indexes. On a database that still has locations, also the one-queue-number rule per
// location, which 027 replaces.
let visitIndexesPromise;
function ensureVisitIndexes() {
  if (!visitIndexesPromise) {
    visitIndexesPromise = runMigration('026_visit_indexes.sql')
      .catch(err => { visitIndexesPromise = null; throw err; });
  }
  return visitIndexesPromise;
}

// One clinic, no locations: merges each drug's stock, keeps families apart and makes queue numbers
// one series per day. Runs after every migration that used location_id.
let removeLocationsPromise;
function ensureLocationsRemoved() {
  if (!removeLocationsPromise) {
    removeLocationsPromise = Promise.all([ensurePrescriptions(), ensureFamilies(), ensurePharmacyDispenses(), ensureVisitIndexes()])
      .then(() => runMigration('027_remove_locations.sql'))
      .then(async () => {
        const { rows } = await db.query(
          `SELECT pg_get_expr(i.indpred, i.indrelid) AS since FROM pg_index i
           WHERE i.indexrelid = to_regclass('visits_day_queue_no_key')`);
        if (rows[0]?.since) {
          console.warn(`Queue numbers repeat on some past days (from before locations were removed); ` +
            `the database refuses a repeated number only for days after them (${rows[0].since}).`);
        }
      })
      .catch(err => { removeLocationsPromise = null; throw err; });
  }
  return removeLocationsPromise;
}

// users.permissions: what each non-admin account may do (utils/permissions.js).
let accountPermissionsPromise;
function ensureAccountPermissions() {
  if (!accountPermissionsPromise) {
    accountPermissionsPromise = ensureDayAccountsAndFormOptions()
      .then(() => runMigration('028_account_permissions.sql'))
      .catch(err => { accountPermissionsPromise = null; throw err; });
  }
  return accountPermissionsPromise;
}

// hef.has_nssf and hef.uses_hef_nssf: the NSSF questions at registration.
let nssfPromise;
function ensureNssf() {
  if (!nssfPromise) {
    nssfPromise = runMigration('029_nssf.sql')
      .catch(err => { nssfPromise = null; throw err; });
  }
  return nssfPromise;
}

module.exports = {
  ensureNssf,
  ensureAccountPermissions,
  ensureLocationsRemoved,
  ensureVisitIndexes,
  ensurePharmacyDispenses,
  ensureRegistrationRequestId,
  ensureReferralDoctor,
  ensureSharedUserRetired,
  ensureGlassesAndStickerColour,
  ensureDayAccountsAndFormOptions,
  ensureTbFlag,
  ensureDentalPharmacyStations,
  ensureFamilies,
  ensurePrescriptions,
  ensureConsultationConditions,
  ensureReferralSignature,
  ensureStationRouteHistory,
  ensurePharmacyNumericStock,
  ensureVisitsCompleted,
  ensureUserRole,
  ensureVisitStations,
  ensureSnellenFractions,
  ensurePartialStationForms,
  ensureGeneratedFaceId,
  ensureSevaReferral,
  ensureTbScreening,
};
