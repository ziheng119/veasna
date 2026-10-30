import { PARTNER_NGO_NAME } from "./partnerNgo";

// Default order for registration. Active visit routes can be rearranged.
// Must match apps/backend/utils/stations.js.
// Suspected TB is a flag on the visit (see constants/tb.ts), not a station.
export const STATIONS = [
  { id: "triage", label: "Triage" },
  { id: "seva", label: PARTNER_NGO_NAME },
  { id: "physiotherapy", label: "Physiotherapy" },
  { id: "consultation", label: "Consult" },
] as const;

export type StationId = (typeof STATIONS)[number]["id"];

export const ALL_STATION_IDS: StationId[] = STATIONS.map((station) => station.id);

// Ticked by default at registration. The partner NGO is added at Triage when a cataract is suspected.
export const DEFAULT_STATION_IDS: StationId[] = ALL_STATION_IDS.filter((id) => id !== "seva");

// Page where each station's queue is worked. Opening it with ?visit=<id> selects that visit.
export const STATION_PAGES: Record<StationId, string> = {
  triage: "/triage",
  seva: "/seva",
  physiotherapy: "/physiotherapy",
  consultation: "/doctors-consultation",
};

export function stationPageHref(station: StationId, visitId: number): string {
  return `${STATION_PAGES[station]}?visit=${visitId}`;
}

export function stationLabel(id?: string | null): string {
  return STATIONS.find((station) => station.id === id)?.label ?? "";
}
