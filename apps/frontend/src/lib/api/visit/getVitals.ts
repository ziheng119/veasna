import { backend_url } from "@/constants/env_variable";
import { Vitals } from "@/lib/types/vitals";
import formatDate from "@/helper/format_date"; // optional if you want to format dates

// Cache for vitals per patientId + visitId
const cachedVitals: Record<string, Vitals> = {};
const cachedETags: Record<string, string> = {};

export async function getVitals(patientId: number, visitId: number): Promise<Vitals | null> {
  const cacheKey = `${patientId}_${visitId}`;

  try {
    const headers: HeadersInit = {};

    // Add If-None-Match header if we have an ETag for this record
    if (cachedETags[cacheKey]) {
      headers['If-None-Match'] = cachedETags[cacheKey];
    }

    const res = await fetch(`${backend_url}/api/visits/vitals/${patientId}/${visitId}`, { headers });

    if (res.status === 304 && cachedVitals[cacheKey]) {
      console.log(`✅ Vitals for patient ${patientId} visit ${visitId} not modified, using cache`);
      return cachedVitals[cacheKey];
    }

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    const data: Vitals = {
      ...json,
      last_updated_at: formatDate(json.last_updated_at),
      created_at: formatDate(json.created_at),
    };

    // Update cache and ETag
    cachedVitals[cacheKey] = data;
    cachedETags[cacheKey] = res.headers.get('ETag') || '';

    return data;

  } catch (err) {
    console.error("GET Vitals (Error):", err);

    // Fallback to cached data if available
    if (cachedVitals[cacheKey]) {
      console.warn(`⚠️ Returning cached vitals for patient ${patientId} visit ${visitId} due to fetch failure.`);
      return cachedVitals[cacheKey];
    }

    return null;
  }
}
