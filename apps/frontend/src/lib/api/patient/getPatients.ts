import { backend_url } from "@/constants/env_variable";

// Cache for patient data
const cachedPatients: Record<number, any> = {};
const cachedETags: Record<number, string> = {};

export async function getPatient(patientId: number, token: string) {
  const cacheKey = patientId;

  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    // Add If-None-Match header if we have an ETag for this patient
    if (cachedETags[cacheKey]) {
      headers['If-None-Match'] = cachedETags[cacheKey];
    }

    const res = await fetch(`${backend_url}/api/patient/${patientId}`, {
      cache: "no-cache",
      headers,
    });

    if (res.status === 304 && cachedPatients[cacheKey]) {
      // Data not modified, return cached
      console.log(`Patient ${patientId} data not modified, using cache`);
      return cachedPatients[cacheKey];
    }

    if (res.status === 404) {
      console.error(`Patient ${patientId} not found`);
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch patient: ${res.statusText}`);
    }

    const data = await res.json();

    // Update cache and ETag
    cachedPatients[cacheKey] = data;
    cachedETags[cacheKey] = res.headers.get('ETag') || '';

    console.log(`GET Patient ${patientId} (Success)`);
    return data;
  } catch (err: any) {
    console.error('GET Patient (Error):', err);

    // Fallback to cached data if available
    if (cachedPatients[cacheKey]) {
      console.warn(`Returning cached patient ${patientId} due to fetch failure.`);
      return cachedPatients[cacheKey];
    }

    return null;
  }
}

// Clear cache for a specific patient (useful after updates)
export function clearPatientCache(patientId: number) {
  delete cachedPatients[patientId];
  delete cachedETags[patientId];
  console.log(`Cleared cache for patient ${patientId}`);
}

// Clear all patient cache
export function clearAllPatientCache() {
  Object.keys(cachedPatients).forEach(key => {
    delete cachedPatients[Number(key)];
  });
  Object.keys(cachedETags).forEach(key => {
    delete cachedETags[Number(key)];
  });
  console.log('Cleared all patient cache');
}