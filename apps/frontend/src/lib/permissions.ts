import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";

export const ROLE_OPTIONS = [
  { value: "user", label: "User (create and view)" },
  { value: "admin", label: "Administrator (create, view and edit)" },
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
// enforces saved-record edits and limits screening-day accounts to their day's patients.
export const ADMIN_PAGES = ["/analytics", "/station-data", "/accounts"] as const;

export function canAccessPage(role: string | undefined, path: string): boolean {
  if (role === "admin") return true;
  return role === "user" && !ADMIN_PAGES.some(page => path === page || path.startsWith(`${page}/`));
}
export function canEditSavedData(role: string | undefined): boolean {
  return role === "admin";
}
/** Analytics, bulk referral printing and downloading every patient's data are admin-only. */
export function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}
export function defaultPage(role: string | undefined): string {
  return canAccessPage(role, "/") ? "/" : "/login";
}
