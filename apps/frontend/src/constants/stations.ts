import { PARTNER_NGO_NAME } from "./partnerNgo";

// Stations in clinic order. Active visit routes can be rearranged. Dental comes before Consult so
// the doctor sees anything dental found and can refer on.
// Must match apps/backend/utils/stations.js.
// Suspected TB is a flag on the visit (see constants/tb.ts), not a station.
export const STATIONS = [
  { id: "triage", label: "Triage" },
  { id: "dental", label: "Dental" },
  { id: "consultation", label: "Consult" },
  { id: "physiotherapy", label: "Physiotherapy" },
  { id: "seva", label: PARTNER_NGO_NAME },
  { id: "pharmacy", label: "Pharmacy" },
] as const;

export type StationId = (typeof STATIONS)[number]["id"];

export const ALL_STATION_IDS: StationId[] = STATIONS.map((station) => station.id);

// Offered at registration. Physiotherapy is chosen by the doctor at Consult, and Pharmacy is added
// when the doctor prescribes. Must match REGISTRATION_STATIONS in apps/backend/utils/stations.js.
export const REGISTRATION_STATION_IDS: StationId[] = ["triage", "dental", "consultation", "seva"];

// Stations only the Consult page adds: Physiotherapy ("Refer to physiotherapy station", it has
// limited places) and Pharmacy (when the doctor prescribes). Send to can reorder, remove or revisit
// them but not add them. Must match DOCTOR_ADDED_STATIONS in apps/backend/utils/stations.js.
export const DOCTOR_ADDED_STATION_IDS: StationId[] = ["physiotherapy", "pharmacy"];

// Ticked by default at registration. The partner NGO is added at Triage when a cataract is suspected.
export const DEFAULT_STATION_IDS: StationId[] = ["triage", "dental", "consultation"];

// Page where each station's queue is worked. Opening it with ?visit=<id> selects that visit.
export const STATION_PAGES: Record<StationId, string> = {
  triage: "/triage",
  consultation: "/doctors-consultation",
  physiotherapy: "/physiotherapy",
  dental: "/dental",
  seva: "/seva",
  pharmacy: "/pharmacy",
};

export function stationPageHref(station: StationId, visitId: number): string {
  return `${STATION_PAGES[station]}?visit=${visitId}`;
}

export function stationLabel(id?: string | null): string {
  return STATIONS.find((station) => station.id === id)?.label ?? "";
}
