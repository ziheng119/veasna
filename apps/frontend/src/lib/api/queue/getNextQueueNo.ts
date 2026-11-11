import { backend_url } from "@/constants/env_variable";
import { apiFetch } from "@/lib/api/request";

// Preview of the queue number the next registration at this location will receive.
// The backend assigns the actual number when the visit is created.
export async function getNextQueueNo(locationId: number, token: string, signal?: AbortSignal): Promise<string> {
  const res = await apiFetch(`${backend_url}/api/queue/next?location_id=${locationId}`, {
    cache: "no-cache",
    signal,
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch next queue number: ${res.statusText}`);
  }

  const data = await res.json();
  return data.queue_no;
}
