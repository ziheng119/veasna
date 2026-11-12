// Every account except the admin sees only the patients queued on one day, and those patients'
// earlier visits (their history, opened from their queue card). Patient data is therefore limited
// to the villagers who come that day; only the admin browses every patient.
//   Screening-day accounts (users.screening_date set, e.g. dec13village for 2026-12-13), shared by
//   every volunteer on that day: that date. They save only on that date.
//   Other non-admin accounts (e.g. the retired shared "user"): the host's clinic day.
// Saves are allowed only to that day's visits.
//
// Lists filter themselves with patientOnDaySql; single records are checked by checkDayScope, which
// authorizeApi runs before every request. A request it does not know is refused (fail closed).
const { toPositiveInt } = require('./validation');
const { currentVisitDate } = require('./queueNumber');

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
  [/^\/(queue|queue\/next|patients|patients\/search|patients\/lookup|visits\/seva-referrals|prescriptions\/patients|pharmacy|pharmacy\/stats|locations|auth\/me|users|form-options)$/, () => ({})],
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
  // has already confirmed is the screening day. Adding a medicine holds no patient data.
  [/^\/(registration|visits|patients|pharmacy)$/, () => ({})],
];

const ids = values => [...new Set((values ?? []).map(toPositiveInt).filter(Boolean))];

// The day an account is limited to (YYYY-MM-DD), or null for the admin. Lists filter with it
// (req.user.scope_date, set by middleware/authorizeApi.js).
function scopeDate(user) {
  if (!user || user.role === 'admin') return null;
  return user.screening_date || currentVisitDate();
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
// ({ all: true }); otherwise only visits dated its day, and only while it is that day on the host
// (day is null on any other date, so nothing is editable). Lets Patient Details show earlier visits
// as read-only instead of failing on save.
function saveScope(user) {
  const day = user?.scope_date === undefined ? scopeDate(user) : user.scope_date;
  if (!day) return { all: true, day: null };
  return { all: false, day: currentVisitDate() === day ? day : null };
}

// Resolves to null when the request may go ahead, otherwise { status, message }.
async function checkDayScope(db, req, rawPath) {
  const day = req.user?.scope_date === undefined ? scopeDate(req.user) : req.user.scope_date;
  if (!day) return null;
  const path = rawPath.replace(/\/+$/, '') || '/';
  const reading = req.method === 'GET' || req.method === 'HEAD';
  if (!reading && currentVisitDate() !== day) {
    return { status: 403, message: `This account is for the screening on ${day}. It can only save on that day.` };
  }
  const rule = (reading ? READ_RULES : WRITE_RULES).find(([pattern]) => pattern.test(path));
  if (!rule) return { status: 403, message: 'This screening-day account cannot do this.' };
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
    ? { status: 404, message: 'Not found. This account only shows patients queued on its screening day.' }
    : { status: 403, message: 'This account can only change visits from its screening day.' };
}

module.exports = { patientOnDaySql, checkDayScope, scopeDate, saveScope, screeningDayEnded, screeningDayEndedMessage };
