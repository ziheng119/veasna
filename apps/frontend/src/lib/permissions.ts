import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";

export const ROLE_OPTIONS = [
  { value: "user", label: "User (view, enter and correct records)" },
  { value: "admin", label: "Administrator (everything)" },
] as const;

export const NAVIGATION = [
  { href: "/", label: "Home" },
  { href: "/patient-list", label: "Patient List" },
  // Stations in clinic order (constants/stations.ts).
  { href: "/triage", label: "Triage" },
  { href: "/dental", label: "Dental" },
  { href: "/doctors-consultation", label: "Consult" },
  { href: "/physiotherapy", label: "Physiotherapy" },
  { href: "/seva", label: PARTNER_NGO_NAME },
  { href: "/pharmacy", label: "Pharmacy" },
] as const;

// Pages only an admin may open. Every other page is open to both roles; the API separately
// limits screening-day accounts to their day's patients.
export const ADMIN_PAGES = ["/analytics", "/station-data", "/accounts"] as const;

export function canAccessPage(role: string | undefined, path: string): boolean {
  if (role === "admin") return true;
  return role === "user" && !ADMIN_PAGES.some(page => path === page || path.startsWith(`${page}/`));
}
/**
 * Changing saved records (patient details, visit records, station forms, referrals) is open to
 * both roles, so doctors can add what they find as the patient moves through the stations.
 * Matches canEditSavedRecords in apps/backend/utils/permissions.js.
 */
export function canEditSavedData(role: string | undefined): boolean {
  return role === "admin" || role === "user";
}
/**
 * Admin only: deleting records, printing referrals (one or many), downloading patient data,
 * Analytics, Station data, Accounts, and pharmacy stock and dispensing.
 */
export function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}
export function defaultPage(role: string | undefined): string {
  return canAccessPage(role, "/") ? "/" : "/login";
}
