import { backend_url } from "@/constants/env_variable";
import { QueuedPatient } from "@/lib/types/patient";
import { StationId } from "@/constants/stations";
import { apiFetch } from "@/lib/api/request";

// Cache for queue per date and station
const cachedQueues: Record<string, QueuedPatient[]> = {};
const cachedETags: Record<string, string> = {};

export function clearQueueCache() {
  Object.keys(cachedQueues).forEach(key => delete cachedQueues[key]);
  Object.keys(cachedETags).forEach(key => delete cachedETags[key]);
}

// Ask for the backend's current clinic day. Client clocks on an offline LAN cannot sync
// over the internet, so "today" comes from the host that also dates new registrations.
export const CLINIC_TODAY = null;

// With a station, returns only the visits currently waiting at that station, in arrival order.
export async function getQueue(date: string | typeof CLINIC_TODAY, token: string, station?: StationId, signal?: AbortSignal) {
  const cacheKey = `${date ?? "today"}_${station ?? "all"}`;

  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    // Add If-None-Match header if we have an ETag for this queue
    if (!signal && cachedETags[cacheKey]) {
      headers['If-None-Match'] = cachedETags[cacheKey];
    }

    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (station) params.set("station", station);
    const res = await apiFetch(`${backend_url}/api/queue${params.toString() ? `?${params}` : ""}`, {
      // Always revalidated with the server; an unchanged list returns 304 without a body.
      cache: "no-cache",
      headers,
      signal,
    });

    if (res.status === 304 && cachedQueues[cacheKey]) {
      // Data not modified, return cached
      return cachedQueues[cacheKey];
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch queue: ${res.statusText}`);
    }

    const data = await res.json();

    // Update cache and ETag
    if (!signal) {
      cachedQueues[cacheKey] = data;
      cachedETags[cacheKey] = res.headers.get('ETag') || '';
    }

    return data;
  } catch (err: unknown) {
    // Live callers retain their last successful list and surface refresh failures.
    if (signal) throw err;
    console.error('❌ GET Queue (Error):', err);

    // Fallback to cached data if available
    if (cachedQueues[cacheKey]) {
      console.warn(`Returning cached queue for ${date ?? "today"} due to fetch failure.`);
      return cachedQueues[cacheKey];
    }

    return [];
  }
}
