import { backend_url } from "@/constants/env_variable";
import { VisualAcuity } from "@/lib/types/visualAcuity";
import formatDate from "@/helper/format_date";

// Cache for visual acuity per patientId + visitId
const cachedVisualAcuity: Record<string, VisualAcuity> = {};
const cachedETags: Record<string, string> = {};

export async function getVisualAcuity(patientId: number, visitId: number): Promise<VisualAcuity | null> {
  const cacheKey = `${patientId}_${visitId}`;

  try {
    const headers: HeadersInit = {};

    // Add If-None-Match header if we have an ETag for this record
    if (cachedETags[cacheKey]) {
      headers['If-None-Match'] = cachedETags[cacheKey];
    }

    const res = await fetch(`${backend_url}/api/visits/visual-acuity/${patientId}/${visitId}`, { headers });

    if (res.status === 304 && cachedVisualAcuity[cacheKey]) {
      console.log(`✅ Visual Acuity for patient ${patientId} visit ${visitId} not modified, using cache`);
      return cachedVisualAcuity[cacheKey];
    }

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    const data: VisualAcuity = {
      ...json,
      last_updated_at: formatDate(json.last_updated_at),
      created_at: formatDate(json.created_at),
    };

    // Update cache and ETag
    cachedVisualAcuity[cacheKey] = data;
    cachedETags[cacheKey] = res.headers.get('ETag') || '';

    return data;

  } catch (err) {
    console.error("GET Visual Acuity (Error):", err);

    // Fallback to cached data if available
    if (cachedVisualAcuity[cacheKey]) {
      console.warn(`⚠️ Returning cached Visual Acuity for patient ${patientId} visit ${visitId} due to fetch failure.`);
      return cachedVisualAcuity[cacheKey];
    }

    return null;
  }
}
