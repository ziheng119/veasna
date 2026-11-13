import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";

export const ROLE_OPTIONS = [
  { value: "user", label: "User (what the admin ticked for the account)" },
  { value: "admin", label: "Administrator (everything)" },
] as const;

/**
 * What a non-admin account may do, ticked by the admin on the Accounts page. The admin may do
 * everything. Keep in step with apps/backend/utils/permissions.js, which enforces them.
 * `requires`: ticking this ticks those too (and unticking one of those unticks this).
 */
export const PERMISSIONS = [
  { key: "view_today", label: "See today's patients", description: "The Patient List with everyone queued today. Without it, the account works from the station queues only.", group: "Patients" },
  { key: "edit_today", label: "Edit today's queue", description: "Register patients, fill in station forms and move patients through the queue.", group: "Patients" },
  { key: "view_past", label: "See past patients", description: "Patients from earlier screening days, and every earlier visit.", group: "Patients", requires: ["view_today"] },
  { key: "edit_past", label: "Edit past visits", description: "Correct the records of visits from earlier days.", group: "Patients", requires: ["edit_today", "view_past"] },
  { key: "pharmacy", label: "Pharmacy stock", description: "Add drugs, change stock counts, dispense and cancel prescriptions.", group: "Extras" },
  { key: "print", label: "Print and download", description: "Print referrals and download the patient data spreadsheet.", group: "Extras" },
  { key: "analytics", label: "Analytics", description: "Open the Analytics page: totals, trends and referral lists.", group: "Extras" },
] as const satisfies readonly { key: string; label: string; description: string; group: string; requires?: readonly string[] }[];

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const DEFAULT_PERMISSIONS: Permission[] = ["view_today", "edit_today"];
const ALL_PERMISSIONS = PERMISSIONS.map(permission => permission.key) as Permission[];

export function permissionLabel(key: Permission): string {
  return PERMISSIONS.find(permission => permission.key === key)?.label ?? key;
}

const requiresOf = (key: Permission): readonly Permission[] =>
  (PERMISSIONS.find(permission => permission.key === key) as { requires?: readonly Permission[] } | undefined)?.requires ?? [];

/**
 * The chosen permissions after ticking (on) or unticking (off) one: ticking also ticks what it
 * needs, unticking also unticks what needs it. Always in the order of PERMISSIONS.
 */
export function togglePermission(chosen: readonly Permission[], key: Permission, on: boolean): Permission[] {
  const next = new Set(chosen);
  const visit = (current: Permission) => {
    if (on) {
      next.add(current);
      requiresOf(current).forEach(visit);
    } else {
      next.delete(current);
      ALL_PERMISSIONS.filter(other => requiresOf(other).includes(current) && next.has(other)).forEach(visit);
    }
  };
  visit(key);
  return ALL_PERMISSIONS.filter(permission => next.has(permission));
}

/** An account as far as permissions go: the signed-in user, or an account on the Accounts page. */
export type PermissionHolder = { role?: string; permissions?: readonly string[] | null } | null | undefined;

/** The admin has every permission; other accounts what was saved, or the defaults when none is known. */
export function permissionsOf(account: PermissionHolder): Permission[] {
  if (!account) return [];
  if (account.role === "admin") return [...ALL_PERMISSIONS];
  if (account.role !== "user") return [];
  const saved = account.permissions ?? DEFAULT_PERMISSIONS;
  return ALL_PERMISSIONS.filter(permission => saved.includes(permission));
}

export function can(account: PermissionHolder, key: Permission): boolean {
  return permissionsOf(account).includes(key);
}

export const NAVIGATION = [
  { href: "/patient-list", label: "Patient List" },
  { href: "/", label: "Registration" },
  // Stations in clinic order (constants/stations.ts).
  { href: "/triage", label: "Triage" },
  { href: "/dental", label: "Dental" },
  { href: "/doctors-consultation", label: "Consult" },
  { href: "/physiotherapy", label: "Physiotherapy" },
  { href: "/seva", label: PARTNER_NGO_NAME },
  { href: "/pharmacy", label: "Pharmacy" },
] as const;

// Pages only an admin may open, and pages that need a permission. Every other page is open to
// every account; the API separately limits what each account sees and saves.
export const ADMIN_PAGES = ["/station-data", "/accounts"] as const;
const PAGE_PERMISSIONS: { path: string; permission: Permission }[] = [
  { path: "/analytics", permission: "analytics" },
  { path: "/patient-list", permission: "view_today" },
];
const under = (path: string, page: string) => path === page || path.startsWith(`${page}/`);

export function canAccessPage(account: PermissionHolder, path: string): boolean {
  if (account?.role === "admin") return true;
  if (account?.role !== "user") return false;
  if (ADMIN_PAGES.some(page => under(path, page))) return false;
  const needed = PAGE_PERMISSIONS.find(page => under(path, page.path));
  return !needed || can(account, needed.permission);
}
/**
 * Changing saved records (patient details, visit records, station forms, referrals) and moving
 * patients through the queue: "Edit today's queue". Which visits is the server's answer
 * (VisitSummary.editable, see canEditVisit). Matches the backend's edit_today check.
 */
export function canEditSavedData(account: PermissionHolder): boolean {
  return can(account, "edit_today");
}
/**
 * Changing one visit's records on Patient Details: the admin any visit; other accounts the visits
 * their permissions allow (today's with "Edit today's queue", earlier ones with "Edit past visits").
 * `editable` is the server's answer for this account (VisitSummary.editable); it refuses other saves.
 */
export function canEditVisit(account: PermissionHolder, visit: { editable?: boolean } | undefined): boolean {
  return canEditSavedData(account) && (account?.role === "admin" || visit?.editable === true);
}
/**
 * Admin only: deleting records, Station data and Accounts. Other admin-era actions now have their
 * own permissions (pharmacy, print, analytics); use can() for those.
 */
export function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}
/** Where to go after signing in, or from a page the account may not open: Registration. */
export function defaultPage(account: PermissionHolder): string {
  return canAccessPage(account, "/") ? "/" : "/login";
}
