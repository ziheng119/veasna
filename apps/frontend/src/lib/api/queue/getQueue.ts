import { backend_url } from "@/constants/env_variable";
import { QueuedPatient } from "@/lib/types/patient";
import { StationId } from "@/constants/stations";

// Cache for queue per location + date
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
export async function getQueue(locationId: number, date: string | typeof CLINIC_TODAY, token: string, station?: StationId, signal?: AbortSignal) {
  const cacheKey = `${locationId}_${date ?? "today"}_${station ?? "all"}`;

  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    // Add If-None-Match header if we have an ETag for this queue
    if (!signal && cachedETags[cacheKey]) {
      headers['If-None-Match'] = cachedETags[cacheKey];
    }

    const params = new URLSearchParams({ location_id: String(locationId) });
    if (date) params.set("date", date);
    if (station) params.set("station", station);
    const res = await fetch(`${backend_url}/api/queue?${params}`, {
      // Always revalidated with the server; an unchanged list returns 304 without a body.
      cache: "no-cache",
      headers,
      signal,
    });

    if (res.status === 304 && cachedQueues[cacheKey]) {
      // Data not modified, return cached
      console.log(`✅ Queue for location ${locationId} on ${date} not modified, using cache`);
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

    console.log(`✅ GET Queue for location ${locationId} on ${date} (Success)`);
    return data;
  } catch (err: unknown) {
    // Live callers retain their last successful list and surface refresh failures.
    if (signal) throw err;
    console.error('❌ GET Queue (Error):', err);

    // Fallback to cached data if available
    if (cachedQueues[cacheKey]) {
      console.warn(`⚠️ Returning cached queue for location ${locationId} on ${date} due to fetch failure.`);
      return cachedQueues[cacheKey];
    }

    return [];
  }
}
