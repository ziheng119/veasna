// Stations a visit can be routed through, in the order patients move through them.
// Must match apps/backend/utils/stations.js.
export const STATIONS = [
  { id: "triage", label: "Triage" },
  { id: "seva", label: "Seva" },
  { id: "physiotherapy", label: "Physiotherapy" },
  { id: "consultation", label: "Consult" },
] as const;

export type StationId = (typeof STATIONS)[number]["id"];

export const ALL_STATION_IDS: StationId[] = STATIONS.map((station) => station.id);

// Ticked by default at registration. Seva is added at Triage when a cataract is suspected.
export const DEFAULT_STATION_IDS: StationId[] = ALL_STATION_IDS.filter((id) => id !== "seva");

export function stationLabel(id?: string | null): string {
  return STATIONS.find((station) => station.id === id)?.label ?? "";
}
