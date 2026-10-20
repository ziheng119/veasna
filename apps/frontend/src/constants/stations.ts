// Default order for registration. Active visit routes can be rearranged.
// Must match apps/backend/utils/stations.js.
// The TB tent comes first: a patient flagged for suspected TB waits there and cannot be seen at
// any other station until a TB doctor clears them.
export const STATIONS = [
  { id: "tb", label: "TB Tent" },
  { id: "triage", label: "Triage" },
  { id: "seva", label: "Seva" },
  { id: "physiotherapy", label: "Physiotherapy" },
  { id: "consultation", label: "Consult" },
] as const;

export type StationId = (typeof STATIONS)[number]["id"];

export const ALL_STATION_IDS: StationId[] = STATIONS.map((station) => station.id);

// Ticked by default at registration. Seva is added at Triage when a cataract is suspected, and
// the TB tent when TB red flags are ticked.
export const DEFAULT_STATION_IDS: StationId[] = ALL_STATION_IDS.filter((id) => id !== "seva" && id !== "tb");

export function stationLabel(id?: string | null): string {
  return STATIONS.find((station) => station.id === id)?.label ?? "";
}
