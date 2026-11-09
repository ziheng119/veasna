const ROLES = ["admin", "user"];
const LEGACY_ROLES = [
  "registration",
  "triage",
  "tb",
  "seva",
  "physiotherapy",
  "consultation",
  "pharmacy",
];
// Compatibility while existing installations apply the role migration. Unknown roles fail closed.
function normalizeRole(role) {
  return LEGACY_ROLES.includes(role) ? "user" : role;
}
// Changing saved patient records (patient details, a visit's details, vitals and HEF, the TB record,
// every station form and the referral) is open to every account, so doctors can correct and add
// what they find as the patient moves through the stations. Deleting records, pharmacy stock,
// printing many referrals, downloads, Analytics and settings stay admin-only.
// Saved-record upserts use this in their ON CONFLICT ... WHERE, so an unknown role still fails closed.
function canEditSavedRecords(rawRole) {
  return ROLES.includes(normalizeRole(rawRole));
}
// Correcting saved records on Patient Details: PUT patient/{id}, PUT visits/{id},
// PUT visits/{id}/vitals and PUT visits/{id}/tb (routes/patient.js, routes/visitEdits.js).
function isRecordEdit(method, path) {
  return method === "PUT" && (/^\/patient\/\d+$/.test(path) || /^\/visits\/\d+(\/(vitals|tb))?$/.test(path));
}
// Moving a patient through the clinic: finish a station, change the remaining route or one station
// on it, or discharge. This is patient flow, not an edit of saved records, so users may do it.
function isQueueMovement(method, path) {
  return (
    (method === "POST" && /^\/queue\/\d+\/(complete|stations\/[a-z]+\/complete)$/.test(path)) ||
    (method === "PUT" && /^\/queue\/\d+\/stations(\/[a-z]+)?$/.test(path))
  );
}
// Reads only an admin may make: Analytics, the download of all patient data, every saved referral
// at once (bulk printing) and the account list.
function isAdminOnlyRead(path) {
  return /^\/(analytics|accounts|export)(\/|$)/.test(path) || path === "/visits/referrals";
}
function canAccessApi(rawRole, method, rawPath) {
  const role = normalizeRole(rawRole);
  if (!ROLES.includes(role)) return false;
  const path = rawPath.replace(/\/+$/, "") || "/";
  // Accounts are created on the Accounts page (POST /accounts), never through these older addresses.
  if (method === "POST" && ["/auth/register", "/users"].includes(path)) return false;
  if (role === "admin") return true;
  if (method === "GET" || method === "HEAD") return !isAdminOnlyRead(path);
  if (isQueueMovement(method, path) || isRecordEdit(method, path)) return true;
  if (method !== "POST") return false;
  // Only endpoints that create or save patient records. POST alone is not proof that a request
  // only touches patient records (e.g. dispensing changes stock), so each is listed.
  return (
    [
      "/registration",
      "/patients",
      "/visits",
      "/pharmacy",
      "/triage/visual-acuity",
      "/triage/presenting-complaint",
      "/triage/history",
      // Grouping today's patients into a family, or taking one out (routes/family.js).
      "/family",
      "/family/leave",
    ].includes(path) ||
    /^\/visits\/(seva|physiotherapy|dental|consultation|referral)\/\d+$/.test(path) ||
    // Flagging suspected TB is a first entry; the route refuses users removing or editing a flag.
    /^\/tb\/\d+\/flag$/.test(path) ||
    // Prescribing is a first entry (it reserves stock). Dispensing or cancelling a prescription
    // changes stock, so like other dispensing it is admin-only.
    path === "/prescriptions"
  );
}
module.exports = { ROLES, normalizeRole, canAccessApi, canEditSavedRecords };
