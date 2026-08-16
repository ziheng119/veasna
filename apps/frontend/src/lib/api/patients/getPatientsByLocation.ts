import { backend_url } from "@/constants/env_variable";
import { PatientInfo } from "@/lib/types/patient";

// Cache for patients per location (+ optional visit date)
const cachedPatients: Record<string, PatientInfo[]> = {};
const cachedETags: Record<string, string> = {};

function cacheKey(locationId: number, visitDate?: string) {
  return visitDate ? `${locationId}_${visitDate}` : String(locationId);
}

export function clearPatientsByLocationCache() {
  Object.keys(cachedPatients).forEach(key => delete cachedPatients[key]);
  Object.keys(cachedETags).forEach(key => delete cachedETags[key]);
}

export async function getPatientsByLocation(
  locationId: number,
  token: string,
  visitDate?: string
): Promise<PatientInfo[]> {
  const key = cacheKey(locationId, visitDate);

  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    if (cachedETags[key]) {
      headers['If-None-Match'] = cachedETags[key];
    }

    const params = new URLSearchParams({ location_id: String(locationId) });
    if (visitDate) {
      params.set('visit_date', visitDate);
    }

    const res = await fetch(`${backend_url}/api/patients?${params.toString()}`, {
      cache: "no-cache",
      headers,
    });

    if (res.status === 304 && cachedPatients[key]) {
      console.log(`✅ Patients for location ${locationId} not modified, using cache`);
      return cachedPatients[key];
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch patients: ${res.status} ${res.statusText}`);
    }

    const data: PatientInfo[] = await res.json();

    cachedPatients[key] = data;
    cachedETags[key] = res.headers.get('ETag') || '';

    console.log(`✅ GET Patients for location ${locationId} (Success): ${data.length}`);
    return data;
  } catch (err: any) {
    console.error('❌ GET Patients (Error):', err);

    if (cachedPatients[key]) {
      console.warn(`⚠️ Returning cached patients for location ${locationId} due to fetch failure.`);
      return cachedPatients[key];
    }

    return [];
  }
}
