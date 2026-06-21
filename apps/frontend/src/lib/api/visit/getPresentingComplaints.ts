import { backend_url } from "@/constants/env_variable";
import { PresentingComplaint } from "@/lib/types/medicalHistory";

// Cache for presenting complaint per patientId + visitId
const cachedComplaints: Record<string, PresentingComplaint> = {};
const cachedETags: Record<string, string> = {};

export async function getPresentingComplaint(patientId: number, visitId: number): Promise<PresentingComplaint | null> {
  const cacheKey = `${patientId}_${visitId}`;

  try {
    const headers: HeadersInit = {};

    // Add If-None-Match header if we have an ETag for this complaint
    if (cachedETags[cacheKey]) {
      headers['If-None-Match'] = cachedETags[cacheKey];
    }

    const res = await fetch(`${backend_url}/api/visits/presenting-complaint/${patientId}/${visitId}`, { headers });

    if (res.status === 304 && cachedComplaints[cacheKey]) {
      console.log(`✅ Presenting Complaint for patient ${patientId} visit ${visitId} not modified, using cache`);
      return cachedComplaints[cacheKey];
    }

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    const data: PresentingComplaint = {
      history: json.history || "N/A",
      red_flags: json.red_flags || "N/A",
      systems_review: json.systems_review || "N/A",
      drug_allergies: json.drug_allergies || "N/A",
    };

    // Update cache and ETag
    cachedComplaints[cacheKey] = data;
    cachedETags[cacheKey] = res.headers.get('ETag') || '';

    return data;

  } catch (err) {
    console.error("GET Presenting Complaint (Error):", err);

    // Fallback to cached data if available
    if (cachedComplaints[cacheKey]) {
      console.warn(`⚠️ Returning cached presenting complaint for patient ${patientId} visit ${visitId} due to fetch failure.`);
      return cachedComplaints[cacheKey];
    }

    return null;
  }
}
