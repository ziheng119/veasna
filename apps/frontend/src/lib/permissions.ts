export const ROLE_OPTIONS = [
  { value: "registration", label: "Registration / Patient records" },
  { value: "triage", label: "Triage" },
  { value: "tb", label: "TB doctor" },
  { value: "seva", label: "Seva" },
  { value: "physiotherapy", label: "Physiotherapy" },
  { value: "consultation", label: "Consultation" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "admin", label: "Administrator" },
] as const;

export const NAVIGATION = [
  { href: "/", label: "Home", role: "registration" },
  { href: "/patient-list", label: "Patient List", role: "registration" },
  { href: "/tb-tent", label: "TB Tent", role: "tb" },
  { href: "/triage", label: "Triage", role: "triage" },
  { href: "/seva", label: "Seva", role: "seva" },
  { href: "/physiotherapy", label: "Physiotherapy", role: "physiotherapy" },
  { href: "/doctors-consultation", label: "Consult", role: "consultation" },
  { href: "/pharmacy", label: "Pharmacy", role: "pharmacy" },
] as const;

/** Legacy general users retain clinical pages, never admin tools. Backend is authoritative. */
export function canAccessPage(role: string | undefined, path: string): boolean {
  if (role === "admin") return true;
  if (path === "/analytics") return false;
  if (role === "user") return true;
  if (path === "/patient-details" || path === "/patient-form") return role === "registration";
  if (path.startsWith("/pharmacy/")) return role === "pharmacy";
  return NAVIGATION.some(item => item.href === path && item.role === role);
}

export function defaultPage(role: string | undefined): string {
  if (role === "admin" || role === "user") return "/";
  return NAVIGATION.find(item => item.role === role)?.href ?? "/login";
}
