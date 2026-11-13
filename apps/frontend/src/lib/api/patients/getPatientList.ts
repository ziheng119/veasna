import { backend_url } from "@/constants/env_variable";
import { PatientInfo } from "@/lib/types/patient";
import { apiFetch, readError } from "@/lib/api/request";

// The Patient List (every patient this account may see), optionally only those seen on a date.
// Cached per date filter, so a dropped connection still shows the last list.
const cachedPatients: Record<string, PatientInfo[]> = {};
const cachedETags: Record<string, string> = {};

const cacheKey = (visitDate?: string) => visitDate || "all";

export function clearPatientListCache() {
  Object.keys(cachedPatients).forEach(key => delete cachedPatients[key]);
  Object.keys(cachedETags).forEach(key => delete cachedETags[key]);
}

export async function getPatientList(token: string, visitDate?: string, signal?: AbortSignal): Promise<PatientInfo[]> {
  const key = cacheKey(visitDate);

  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };

    if (!signal && cachedETags[key]) {
      headers['If-None-Match'] = cachedETags[key];
    }

    const params = new URLSearchParams();
    if (visitDate) {
      params.set('visit_date', visitDate);
    }

    const res = await apiFetch(`${backend_url}/api/patients${params.toString() ? `?${params}` : ""}`, {
      // Always revalidated with the server; an unchanged list returns 304 without a body.
      cache: "no-cache",
      headers,
      signal,
    });

    if (res.status === 304 && cachedPatients[key]) {
      return cachedPatients[key];
    }

    if (!res.ok) {
      throw new Error(await readError(res, "Failed to fetch patients"));
    }

    const data: PatientInfo[] = await res.json();

    if (!signal) {
      cachedPatients[key] = data;
      cachedETags[key] = res.headers.get('ETag') || '';
    }

    return data;
  } catch (err: unknown) {
    if (signal) throw err;
    console.error('GET Patients (Error):', err);

    if (cachedPatients[key]) {
      console.warn('Returning cached patients due to fetch failure.');
      return cachedPatients[key];
    }

    return [];
  }
}
