import { backend_url } from "@/constants/env_variable";

// Cache for queue per location + date
const cachedQueues: Record<string, any> = {};
const cachedETags: Record<string, string> = {};

export async function getQueue(locationId: number, date: string, token: string) {
  const cacheKey = `${locationId}_${date}`;

  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    // Add If-None-Match header if we have an ETag for this queue
    if (cachedETags[cacheKey]) {
      headers['If-None-Match'] = cachedETags[cacheKey];
    }

    const res = await fetch(`${backend_url}/api/queue?location_id=${locationId}&date=${date}`, {
      cache: "no-cache",
      headers,
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
    cachedQueues[cacheKey] = data;
    cachedETags[cacheKey] = res.headers.get('ETag') || '';

    console.log(`✅ GET Queue for location ${locationId} on ${date} (Success)`);
    return data;
  } catch (err: any) {
    console.error('❌ GET Queue (Error):', err);

    // Fallback to cached data if available
    if (cachedQueues[cacheKey]) {
      console.warn(`⚠️ Returning cached queue for location ${locationId} on ${date} due to fetch failure.`);
      return cachedQueues[cacheKey];
    }

    return null;
  }
}
