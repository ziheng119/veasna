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

// What a non-admin account may do, ticked by the admin on the Accounts page (users.permissions,
// migration 028). The admin may do everything. Keep in step with apps/frontend/src/lib/permissions.ts.
//   view_today  Patient List: everyone queued on the account's day. Without it the account works
//               from the station queues only.
//   edit_today  Register patients, fill in station forms and move patients through the queue, on
//               the account's day.
//   view_past   Patients from earlier days: the whole Patient List and every earlier visit. Without
//               it an account sees its day's patients (and their earlier visits, for history).
//   edit_past   Correct visits from earlier days.
//   pharmacy    Add drugs, change stock counts, dispense and cancel prescriptions.
//   print       Print referrals and download all patient data.
//   analytics   The Analytics page.
// Deleting records, Station data and Accounts stay admin-only.
const PERMISSIONS = ["view_today", "edit_today", "view_past", "edit_past", "pharmacy", "print", "analytics"];
const DEFAULT_PERMISSIONS = ["view_today", "edit_today"];
// Ticking one also ticks these, so an account never has an option it can't use.
const REQUIRES = { view_past: ["view_today"], edit_past: ["edit_today", "view_past"] };
// Short names for error messages, matching the Accounts page.
const PERMISSION_LABELS = {
  view_today: "See today's patients",
  edit_today: "Edit today's queue",
  view_past: "See past patients",
  edit_past: "Edit past visits",
  pharmacy: "Pharmacy stock",
  print: "Print and download",
  analytics: "Analytics",
};

// Known permissions only, with what they need, in a fixed order. Returns null for a value that is
// not a list, so a request can be refused instead of guessing.
function normalizePermissions(value) {
  if (!Array.isArray(value)) return null;
  const chosen = new Set(value.filter(key => PERMISSIONS.includes(key)));
  for (const key of [...chosen]) for (const needed of REQUIRES[key] ?? []) chosen.add(needed);
  for (const key of [...chosen]) for (const needed of REQUIRES[key] ?? []) chosen.add(needed);
  return PERMISSIONS.filter(key => chosen.has(key));
}

// The admin has every permission; other accounts what is saved for them. An account saved before
// permissions existed has the defaults.
function permissionsFor(rawRole, saved) {
  const role = normalizeRole(rawRole);
  if (role === "admin") return [...PERMISSIONS];
  if (!ROLES.includes(role)) return [];
  return normalizePermissions(saved ?? DEFAULT_PERMISSIONS) ?? [];
}

function hasPermission(user, key) {
  return permissionsFor(user?.role, user?.permissions).includes(key);
}

// Changing saved patient records (patient details, a visit's details, vitals and HEF, the TB record,
// every station form and the referral) is open to every account that may edit, so doctors can
// correct and add what they find as the patient moves through the stations. Which visits an account
// may change is checked per request (edit_today / edit_past, utils/dayScope.js).
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
// on it, or discharge.
function isQueueMovement(method, path) {
  return (
    (method === "POST" && /^\/queue\/\d+\/(complete|stations\/[a-z]+\/complete)$/.test(path)) ||
    (method === "PUT" && /^\/queue\/\d+\/stations(\/[a-z]+)?$/.test(path))
  );
}
// Endpoints that create or save patient records. POST alone is not proof that a request only
// touches patient records (e.g. dispensing changes stock), so each is listed.
function isRecordSave(method, path) {
  if (method !== "POST") return false;
  return (
    ["/registration", "/patients", "/visits", "/triage/visual-acuity", "/triage/presenting-complaint", "/triage/history",
      // Grouping today's patients into a family, or taking one out (routes/family.js).
      "/family", "/family/leave",
      // Prescribing is a first entry (it reserves stock); dispensing needs the pharmacy permission.
      "/prescriptions"].includes(path) ||
    /^\/visits\/(seva|physiotherapy|dental|consultation|referral)\/\d+$/.test(path) ||
    // Flagging suspected TB is a first entry; the route refuses users removing or editing a flag.
    /^\/tb\/\d+\/flag$/.test(path)
  );
}
// Pharmacy stock: add a drug, change its count or name, dispense, or settle a prescription.
// Deleting a drug stays admin-only.
function isPharmacyChange(method, path) {
  return (
    (method === "POST" && (path === "/pharmacy" || /^\/pharmacy\/\d+\/dispense$/.test(path) ||
      /^\/prescriptions\/\d+\/(dispense|cancel)$/.test(path))) ||
    (method === "PATCH" && /^\/pharmacy\/\d+(\/name)?$/.test(path))
  );
}

// What a request needs, for an account that isn't the admin: a permission key, "admin" (admin
// only), or null (any signed-in account).
function requiredPermission(method, rawPath) {
  const path = rawPath.replace(/\/+$/, "") || "/";
  if (method === "GET" || method === "HEAD") {
    if (/^\/analytics(\/|$)/.test(path)) return "analytics";
    // Every saved referral at once (bulk printing) and the download of all patient data.
    if (/^\/export(\/|$)/.test(path) || path === "/visits/referrals") return "print";
    if (/^\/accounts(\/|$)/.test(path)) return "admin";
    // The Patient List (and its name search), as opposed to the station queues.
    if (path === "/patients" || path === "/patients/search") return "view_today";
    return null;
  }
  if (isQueueMovement(method, path) || isRecordEdit(method, path) || isRecordSave(method, path)) return "edit_today";
  if (isPharmacyChange(method, path)) return "pharmacy";
  return "admin";
}

// null when the account may make the request, otherwise what it lacks: a permission key or "admin".
function missingPermission(rawRole, savedPermissions, method, rawPath) {
  const role = normalizeRole(rawRole);
  if (!ROLES.includes(role)) return "admin";
  const path = rawPath.replace(/\/+$/, "") || "/";
  // Accounts are created on the Accounts page (POST /accounts), never through these older addresses.
  if (method === "POST" && ["/auth/register", "/users"].includes(path)) return "admin";
  if (role === "admin") return null;
  const needed = requiredPermission(method, path);
  if (!needed) return null;
  if (needed === "admin") return "admin";
  // edit_past alone covers saving to an earlier visit; utils/dayScope.js checks which visit it is.
  const permissions = permissionsFor(role, savedPermissions);
  return permissions.includes(needed) ? null : needed;
}

function canAccessApi(rawRole, method, rawPath, savedPermissions) {
  return missingPermission(rawRole, savedPermissions, method, rawPath) === null;
}

// The 403 message for a missing permission.
function permissionMessage(missing) {
  if (missing === "admin") return "Only the admin account can do this.";
  return `This account doesn't have the "${PERMISSION_LABELS[missing]}" permission. Ask the admin to turn it on in Accounts.`;
}

module.exports = {
  ROLES, PERMISSIONS, DEFAULT_PERMISSIONS, PERMISSION_LABELS,
  normalizeRole, normalizePermissions, permissionsFor, hasPermission,
  canAccessApi, missingPermission, permissionMessage, canEditSavedRecords,
};
