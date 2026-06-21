import { backend_url } from "@/constants/env_variable";

// Cache for visit data
const cachedVisits: Record<number, any> = {};
const cachedVisitETags: Record<number, string> = {};

export async function getVisit(visitId: number, token: string) {
  const cacheKey = visitId;

  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    // Add If-None-Match header if we have an ETag for this visit
    if (cachedVisitETags[cacheKey]) {
      headers['If-None-Match'] = cachedVisitETags[cacheKey];
    }

    const res = await fetch(`${backend_url}/api/patient/visit/${visitId}`, {
      headers,
    });

    if (res.status === 304 && cachedVisits[cacheKey]) {
      // Data not modified, return cached
      console.log(`Visit ${visitId} data not modified, using cache`);
      return cachedVisits[cacheKey];
    }

    if (res.status === 404) {
      console.error(`Visit ${visitId} not found`);
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch visit: ${res.statusText}`);
    }

    const data = await res.json();

    // Update cache and ETag
    cachedVisits[cacheKey] = data;
    cachedVisitETags[cacheKey] = res.headers.get('ETag') || '';

    console.log(`GET Visit ${visitId} (Success)`);
    return data;
  } catch (err: any) {
    console.error('GET Visit (Error):', err);

    // Fallback to cached data if available
    if (cachedVisits[cacheKey]) {
      console.warn(`Returning cached visit ${visitId} due to fetch failure.`);
      return cachedVisits[cacheKey];
    }

    return null;
  }
}

// Clear cache for a specific visit
export function clearVisitCache(visitId: number) {
  delete cachedVisits[visitId];
  delete cachedVisitETags[visitId];
  console.log(`Cleared cache for visit ${visitId}`);
}

// Clear all visit cache
export function clearAllVisitCache() {
  Object.keys(cachedVisits).forEach(key => {
    delete cachedVisits[Number(key)];
  });
  Object.keys(cachedVisitETags).forEach(key => {
    delete cachedVisitETags[Number(key)];
  });
  console.log('Cleared all visit cache');
}