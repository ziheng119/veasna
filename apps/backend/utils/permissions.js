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
// Moving a patient through the clinic: finish a station, change the remaining route, or
// discharge. This is patient flow, not an edit of saved records, so users may do it.
function isQueueMovement(method, path) {
  return (
    (method === "POST" && /^\/queue\/\d+\/(complete|stations\/[a-z]+\/complete)$/.test(path)) ||
    (method === "PUT" && /^\/queue\/\d+\/stations$/.test(path))
  );
}
function canAccessApi(rawRole, method, rawPath) {
  const role = normalizeRole(rawRole);
  if (!ROLES.includes(role)) return false;
  const path = rawPath.replace(/\/+$/, "") || "/";
  if (method === "POST" && ["/auth/register", "/users"].includes(path)) return false;
  if (role === "admin") return true;
  if (method === "GET" || method === "HEAD") return true;
  if (isQueueMovement(method, path)) return true;
  if (method !== "POST") return false;
  // Only creation-capable endpoints. Each clinical upsert atomically refuses an
  // existing row for users; POST alone is not proof that a request creates data.
  return (
    [
      "/registration",
      "/patients",
      "/visits",
      "/pharmacy",
      "/triage/visual-acuity",
      "/triage/presenting-complaint",
      "/triage/history",
    ].includes(path) ||
    /^\/visits\/(seva|physiotherapy|consultation|referral)\/\d+$/.test(path) ||
    // Flagging suspected TB is a first entry; the route refuses users removing or editing a flag.
    /^\/tb\/\d+\/flag$/.test(path) ||
    // Prescribing is a first entry (it reserves stock). Dispensing or cancelling a prescription
    // changes stock, so like other dispensing it is admin-only.
    path === "/prescriptions"
  );
}
module.exports = { ROLES, normalizeRole, canAccessApi };
