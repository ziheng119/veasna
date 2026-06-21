import { backend_url } from "@/constants/env_variable";
import { PatientInfo } from "@/lib/types/patient";

// Cache for patients per location
const cachedPatients: Record<number, PatientInfo[]> = {};
const cachedETags: Record<number, string> = {};

export async function getPatientsByLocation(
  locationId: number,
  token: string
): Promise<PatientInfo[]> {
  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    // Add If-None-Match header if we have an ETag for this location
    if (cachedETags[locationId]) {
      headers['If-None-Match'] = cachedETags[locationId];
    }

    const res = await fetch(`${backend_url}/api/patients?location_id=${locationId}`, {
      cache: "no-cache",
      headers,
    });

    if (res.status === 304 && cachedPatients[locationId]) {
      // Data not modified, return cached
      console.log(`✅ Patients for location ${locationId} not modified, using cache`);
      return cachedPatients[locationId];
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch patients: ${res.status} ${res.statusText}`);
    }

    const data: PatientInfo[] = await res.json();

    // Update cache and ETag
    cachedPatients[locationId] = data;
    cachedETags[locationId] = res.headers.get('ETag') || '';

    console.log(`✅ GET Patients for location ${locationId} (Success): ${data.length}`);
    return data;
  } catch (err: any) {
    console.error('❌ GET Patients (Error):', err);

    // Fallback to cached data if available
    if (cachedPatients[locationId]) {
      console.warn(`⚠️ Returning cached patients for location ${locationId} due to fetch failure.`);
      return cachedPatients[locationId];
    }

    return [];
  }
}
