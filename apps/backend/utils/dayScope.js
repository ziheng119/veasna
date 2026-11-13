// Every account except the admin works on one day: a screening-day account (users.screening_date
// set, e.g. dec13village for 2026-12-13, shared by every volunteer that day) on that date, any other
// non-admin account (e.g. the retired shared "user") on the host's clinic day. What it may do there
// is set by its permissions (utils/permissions.js):
//   Reading: the patients queued that day, and those patients' earlier visits (their history, opened
//   from their queue card). With view_past, every patient and visit.
//   Saving: only while it is that day on the host. With edit_today, that day's visits; with
//   edit_past, earlier visits too.
//
// Lists filter themselves with patientOnDaySql and req.user.scope_date (null: no filter); single
// records are checked by checkDayScope, which authorizeApi runs before every request. A request it
// does not know is refused (fail closed).
const { toPositiveInt } = require('./validation');
const { currentVisitDate } = require('./queueNumber');
const { hasPermission } = require('./permissions');

// SQL condition: the patient (patientExpr) has a visit on the date in `param`, or `param` is NULL
// (an account without a screening date).
function patientOnDaySql(patientExpr, param) {
  return `(${param}::date IS NULL OR EXISTS (SELECT 1 FROM visits dv WHERE dv.patient_id = ${patientExpr} AND dv.visit_date = ${param}::date))`;
}

// [path pattern, (match, req) => { patients, visits }] for the records a request reads or changes.
const READ_RULES = [
  [/^\/patient\/visit\/(\d+)$/, m => ({ visits: [m[1]] })],
  [/^\/patients?\/(\d+)$/, m => ({ patients: [m[1]] })],
  [/^\/visits\/(?:vitals|history|visual-acuity|presenting-complaint)\/(\d+)\/(\d+)$/, m => ({ patients: [m[1]], visits: [m[2]] })],
  [/^\/visits\/(?:dental|seva|physiotherapy|consultation|referral)\/(\d+)$/, m => ({ visits: [m[1]] })],
  [/^\/tb\/(\d+)$/, m => ({ visits: [m[1]] })],
  [/^\/prescriptions\/patient\/(\d+)$/, m => ({ patients: [m[1]] })],
  [/^\/prescriptions$/, (_m, req) => ({ visits: [req.query.visit_id] })],
  // Lists that filter by the screening day in their own queries, or that hold no patient records.
  [/^\/(queue|queue\/next|patients|patients\/search|patients\/lookup|visits\/seva-referrals|visits\/referrals|prescriptions\/patients|pharmacy|pharmacy\/stats|auth\/me|users|form-options|export\/patients)$/, () => ({})],
  // Totals with no patient's records (needs the analytics permission).
  [/^\/analytics(\/(referrals|trend))?$/, () => ({})],
];
const WRITE_RULES = [
  [/^\/queue\/(\d+)\/.+$/, m => ({ visits: [m[1]] })],
  // Correcting a patient's details (any patient queued that day) or that day's visit details,
  // vitals and HEF, or TB record, on Patient Details.
  [/^\/patient\/(\d+)$/, m => ({ patients: [m[1]] })],
  [/^\/visits\/(\d+)(?:\/(?:vitals|tb))?$/, m => ({ visits: [m[1]] })],
  [/^\/visits\/(?:dental|seva|physiotherapy|consultation|referral)\/(\d+)$/, m => ({ visits: [m[1]] })],
  [/^\/tb\/(\d+)\/flag$/, m => ({ visits: [m[1]] })],
  [/^\/(triage\/[a-z-]+|prescriptions)$/, (_m, req) => ({ visits: [req.body?.visit_id] })],
  [/^\/family(\/leave)?$/, (_m, req) => ({ patients: [req.body?.patient_id, req.body?.with_patient_id] })],
  // Creating a patient or a visit: the new visit gets today's date, which the date check below
  // has already confirmed is the screening day.
  [/^\/(registration|visits|patients)$/, () => ({})],
  // Pharmacy stock (needs the pharmacy permission), which holds no patient data.
  [/^\/pharmacy(\/\d+(\/(name|dispense))?)?$/, () => ({})],
  [/^\/prescriptions\/\d+\/(dispense|cancel)$/, () => ({})],
];

const ids = values => [...new Set((values ?? []).map(toPositiveInt).filter(Boolean))];

// The day an account works on (YYYY-MM-DD), or null for the admin.
function workingDay(user) {
  if (!user || user.role === 'admin') return null;
  return user.screening_date || currentVisitDate();
}

// The day whose patients an account sees in lists, or null for every patient (the admin, or the
// view_past permission). Lists filter with it (req.user.scope_date, set by middleware/authorizeApi.js).
function scopeDate(user) {
  if (!user || user.role === 'admin' || hasPermission(user, 'view_past')) return null;
  return workingDay(user);
}

// A screening-day account stops working once its day is over on the host's calendar: it can no
// longer sign in, and a device still signed in with it is signed out (middleware/authorizeApi.js
// answers 401). The account and what it saved stay in the database for the admin and analytics.
// Before its day it still signs in (to check the password); the admin and accounts without a
// screening date never end.
function screeningDayEnded(user) {
  if (!user || user.role === 'admin' || !user.screening_date) return false;
  return currentVisitDate() > user.screening_date; // both YYYY-MM-DD
}

function screeningDayEndedMessage(user) {
  return `${user.username} was for the screening on ${user.screening_date}, which has ended. Sign in with the account for today.`;
}

// The visits an account may change, as checkDayScope enforces for saves: every visit for the admin
// ({ all: true }). Other accounts only while it is their day on the host: with edit_past every
// visit, with edit_today that day's visits, otherwise none (day is null). Lets Patient Details show
// visits it can't change as read-only instead of failing on save.
function saveScope(user) {
  const day = workingDay(user);
  if (!day) return { all: true, day: null };
  if (currentVisitDate() !== day || !hasPermission(user, 'edit_today')) return { all: false, day: null };
  return { all: hasPermission(user, 'edit_past'), day };
}

// Resolves to null when the request may go ahead, otherwise { status, message }.
async function checkDayScope(db, req, rawPath) {
  const day = workingDay(req.user);
  if (!day) return null;
  const path = rawPath.replace(/\/+$/, '') || '/';
  const reading = req.method === 'GET' || req.method === 'HEAD';
  if (!reading && currentVisitDate() !== day) {
    return { status: 403, message: `This account is for the screening on ${day}. It can only save on that day.` };
  }
  const rule = (reading ? READ_RULES : WRITE_RULES).find(([pattern]) => pattern.test(path));
  if (!rule) return { status: 403, message: 'This screening-day account cannot do this.' };
  // Every patient and visit: reading with view_past, saving with edit_past.
  if (hasPermission(req.user, reading ? 'view_past' : 'edit_past')) return null;
  const targets = rule[1](path.match(rule[0]), req);
  const patients = ids(targets.patients);
  const visits = ids(targets.visits);
  if (!patients.length && !visits.length) return null;
  // Reading: any visit of a patient seen that day (their history). Saving: that day's visits only.
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM patients p WHERE p.id = ANY($1::int[]) AND ${patientOnDaySql('p.id', '$3')})::int AS patients,
       (SELECT COUNT(*) FROM visits v WHERE v.id = ANY($2::int[])
          AND ${reading ? patientOnDaySql('v.patient_id', '$3') : 'v.visit_date = $3::date'})::int AS visits`,
    [patients, visits, day]
  );
  if (rows[0].patients === patients.length && rows[0].visits === visits.length) return null;
  return reading
    ? { status: 404, message: `Not found. This account only shows patients queued on ${day}; seeing earlier patients needs the "See past patients" permission.` }
    : { status: 403, message: `This account can only change visits from ${day}; earlier visits need the "Edit past visits" permission.` };
}

module.exports = { patientOnDaySql, checkDayScope, workingDay, scopeDate, saveScope, screeningDayEnded, screeningDayEndedMessage };
