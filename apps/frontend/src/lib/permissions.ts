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
  { href: "/doctors-consultation", label: "Consult" },
  { href: "/physiotherapy", label: "Physiotherapy" },
  { href: "/dental", label: "Dental" },
  { href: "/seva", label: PARTNER_NGO_NAME },
  { href: "/pharmacy", label: "Pharmacy" },
] as const;

/** Both roles can observe every page. The API separately enforces saved-record edits. */
export function canAccessPage(role: string | undefined, _path: string): boolean {
  return role === "admin" || role === "user";
}
export function canEditSavedData(role: string | undefined): boolean {
  return role === "admin";
}
export function defaultPage(role: string | undefined): string {
  return canAccessPage(role, "/") ? "/" : "/login";
}
