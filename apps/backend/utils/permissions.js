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
function canAccessApi(rawRole, method, rawPath) {
  const role = normalizeRole(rawRole);
  if (!ROLES.includes(role)) return false;
  const path = rawPath.replace(/\/+$/, "") || "/";
  if (method === "POST" && ["/auth/register", "/users"].includes(path)) return false;
  if (role === "admin") return true;
  if (method === "GET" || method === "HEAD") return true;
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
    /^\/tb\/\d+\/review$/.test(path)
  );
}
module.exports = { ROLES, normalizeRole, canAccessApi };
