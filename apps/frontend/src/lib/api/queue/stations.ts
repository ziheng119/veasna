import { backend_url } from "@/constants/env_variable";
import { StationId } from "@/constants/stations";
import { StationMove } from "@/lib/family";
import { clearQueueCache } from "./getQueue";
import { apiFetch, readError } from "@/lib/api/request";

// Finishes a station and moves the visit to its next indicated station (next_station is null when
// that was the last one and the visit is finished). A family member instead waits for the rest of
// the family at this station (held), and the last one done takes them all on (family_moved).
export async function completeStation(
  visitId: number,
  station: StationId,
  token: string
): Promise<StationMove> {
  const res = await apiFetch(`${backend_url}/api/queue/${visitId}/stations/${station}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(await readError(res, "Failed to complete station"));
  }

  clearQueueCache();
  const data = await res.json();
  return { held: false, waiting_for: [], family_moved: [], ...data };
}

// With a snapshot, saves the explicit route and permits revisits. Without one,
// preserves legacy callers: completed stations stay completed and pending order is retained.
export async function updateVisitStations(
  visitId: number,
  stations: StationId[],
  token: string,
  expectedStations?: { station: StationId; completed: boolean }[]
): Promise<void> {
  const res = await apiFetch(`${backend_url}/api/queue/${visitId}/stations`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ stations, ...(expectedStations ? { ordered: true, expected_stations: expectedStations } : {}) }),
  });

  if (!res.ok) {
    throw new Error(await readError(res, "Failed to update stations"));
  }

  clearQueueCache();
}

// Adds one station to the visit's remaining route in clinic order, or takes it off: the partner NGO
// at Triage, Physiotherapy at Consult. Resolves to the remaining route. Refused for TB patients.
export async function setStationNeeded(
  visitId: number,
  station: StationId,
  needed: boolean,
  token: string
): Promise<StationId[]> {
  const res = await apiFetch(`${backend_url}/api/queue/${visitId}/stations/${station}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ needed }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Failed to update stations"));
  }
  clearQueueCache();
  return (await res.json()).stations;
}
