import { backend_url } from "@/constants/env_variable";
import formatDate from "@/helper/format_date";
import { MedicalHistory } from "@/lib/types/medicalHistory";

// Cache for medical history per patientId + visitId
const cachedHistories: Record<string, MedicalHistory> = {};
const cachedETags: Record<string, string> = {};

export async function getHistory(patientId: number, visitId: number): Promise<MedicalHistory | null> {
  const cacheKey = `${patientId}_${visitId}`;

  try {
    const headers: HeadersInit = {};

    // Add If-None-Match header if we have an ETag for this history
    if (cachedETags[cacheKey]) {
      headers['If-None-Match'] = cachedETags[cacheKey];
    }

    const res = await fetch(`${backend_url}/api/visits/history/${patientId}/${visitId}`, { headers });

    if (res.status === 304 && cachedHistories[cacheKey]) {
      // Data not modified, return cached
      console.log(`✅ History for patient ${patientId} visit ${visitId} not modified, using cache`);
      return cachedHistories[cacheKey];
    }

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    const data: MedicalHistory = {
      ...json,
      last_updated_at: formatDate(json.last_updated_at),
      created_at: formatDate(json.created_at),
    };

    // Update cache and ETag
    cachedHistories[cacheKey] = data;
    cachedETags[cacheKey] = res.headers.get('ETag') || '';

    return data;

  } catch (err) {
    console.error("GET History (Error):", err);

    // Fallback to cached data if available
    if (cachedHistories[cacheKey]) {
      console.warn(`⚠️ Returning cached history for patient ${patientId} visit ${visitId} due to fetch failure.`);
      return cachedHistories[cacheKey];
    }

    return null;
  }
}
