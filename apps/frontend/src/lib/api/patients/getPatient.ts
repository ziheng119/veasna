import { backend_url } from "@/constants/env_variable";
import { PatientInfo } from "@/lib/types/patient";
import formatDate from "@/helper/format_date";

// Cache for patients by id
const cachedPatients: Record<number, PatientInfo> = {};
const cachedETags: Record<number, string> = {};

export async function getPatient(id: number): Promise<PatientInfo | null> {
  try {
    const headers: HeadersInit = {};

    // Add If-None-Match header if we have an ETag for this patient
    if (cachedETags[id]) {
      headers['If-None-Match'] = cachedETags[id];
    }

    const res = await fetch(`${backend_url}/api/patients/${id}`, { 
      cache: "no-cache",
      headers
    });

    if (res.status === 304 && cachedPatients[id]) {
      // Data not modified, return cached
      console.log(`✅ Patient ${id} not modified, using cache`);
      return cachedPatients[id];
    }

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    const data: PatientInfo = {
      ...json,
      date_of_birth: formatDate(json.date_of_birth),
      lastUpdated: json.lastUpdated ? new Date(json.lastUpdated).toISOString() : "",
    };

    // Update cache and ETag
    cachedPatients[id] = data;
    cachedETags[id] = res.headers.get('ETag') || '';

    return data;

  } catch (err) {
    console.error("GET Patient (Error):", err);

    // Fallback to cached data if available
    if (cachedPatients[id]) {
      console.warn(`⚠️ Returning cached patient ${id} due to fetch failure.`);
      return cachedPatients[id];
    }

    return null;
  }
}
