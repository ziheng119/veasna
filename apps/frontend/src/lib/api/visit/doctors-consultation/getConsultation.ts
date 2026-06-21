import { backend_url } from "@/constants/env_variable";
import formatDate from "@/helper/format_date";
import { Consultation, Referral } from "@/lib/types/consultation";

// Cache for consultation per visitId
const cachedConsultation: Record<number, Consultation | null> = {};
const cachedETags: Record<number, string> = {};

/**
 * Fetch consultation + referral data for a given visit.
 * Uses ETag-based caching and 304 handling.
 */
export async function getConsultation(visitId: number): Promise<Consultation | null> {
  try {
    const headers: HeadersInit = {};

    // Add If-None-Match header if we have an ETag for this visit
    if (cachedETags[visitId]) {
      headers["If-None-Match"] = cachedETags[visitId];
    }

    const res = await fetch(`${backend_url}/api/visits/consultation/${visitId}`, {
      headers,
      credentials: "include", // if you're using cookies / JWT
    });

    // Handle 304 Not Modified (use cached data)
    if (res.status === 304) {
      console.log(`✅ Consultation for visit ${visitId} not modified, using cache`);
      return cachedConsultation[visitId] ?? null;
    }

    if (!res.ok) {
      if (res.status === 404) {
        cachedConsultation[visitId] = null;
        cachedETags[visitId] = res.headers.get("ETag") || "";
        return null;
      }
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    // If backend returns null/empty
    if (!json) {
      cachedConsultation[visitId] = null;
      cachedETags[visitId] = res.headers.get("ETag") || "";
      return null;
    }

    let modified_referral: Referral | null

    if (json.referral_date == null && json.referral_type == null && json.illness == null && json.duration == null && json.reason == null) {
      modified_referral = null
    } else {
      // Split into lines, trim whitespace, and filter out empty lines
      const text: string = json.referral_type ?? "";
      const modified_types: string[] = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);  

      modified_referral = { 
        referralDate: formatDate(json.referral_date),
        referralType: modified_types,
        illness: json.illness,
        duration: json.duration,
        reason: json.reason
      }
    }

    // Normalize backend snake_case → camelCase
    const data: Consultation = {
      notes: json.notes ?? "",
      prescription: json.prescription ?? "",
      requireReferral: json.require_referral ?? false,
      referral:  modified_referral
    };

    // Update cache + ETag
    cachedConsultation[visitId] = data;
    cachedETags[visitId] = res.headers.get("ETag") || "";

    return data;
  } catch (err) {
    console.error("GET Consultation (Error):", err);

    // Fallback to cached data if available
    if (cachedConsultation[visitId] !== undefined) {
      console.warn(`⚠️ Returning cached consultation for visit ${visitId} due to fetch failure.`);
      return cachedConsultation[visitId];
    }

    return null;
  }
}
