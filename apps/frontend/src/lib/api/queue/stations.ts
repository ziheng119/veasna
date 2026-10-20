import { backend_url } from "@/constants/env_variable";
import { StationId } from "@/constants/stations";
import { clearQueueCache } from "./getQueue";

// Finishes a station and moves the visit to its next indicated station.
// Resolves to the next station, or null when that was the last one and the visit is finished.
export async function completeStation(
  visitId: number,
  station: StationId,
  token: string
): Promise<StationId | null> {
  const res = await fetch(`${backend_url}/api/queue/${visitId}/stations/${station}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Failed to complete station");
  }

  clearQueueCache();
  const data = await res.json();
  return data.next_station;
}

// With a snapshot, saves the explicit route and permits revisits. Without one,
// preserves legacy callers: completed stations stay completed and pending order is retained.
export async function updateVisitStations(
  visitId: number,
  stations: StationId[],
  token: string,
  expectedStations?: { station: StationId; completed: boolean }[]
): Promise<void> {
  const res = await fetch(`${backend_url}/api/queue/${visitId}/stations`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ stations, ...(expectedStations ? { ordered: true, expected_stations: expectedStations } : {}) }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Failed to update stations");
  }

  clearQueueCache();
}
