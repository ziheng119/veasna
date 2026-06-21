import { backend_url } from "@/constants/env_variable";
import { Seva } from "@/lib/types/seva";

// Cache for SEVA per visitId
const cachedSeva: Record<number, Seva | null> = {};
const cachedETags: Record<number, string> = {};

/**
 * Fetch SEVA data for a given visit.
 * Uses ETag-based caching and 304 handling.
 */
export async function getSeva(visitId: number): Promise<Seva | null> {
  try {
    const headers: HeadersInit = {};

    // Add If-None-Match header if we have an ETag for this visit
    if (cachedETags[visitId]) {
      headers["If-None-Match"] = cachedETags[visitId];
    }

    const res = await fetch(`${backend_url}/api/visits/seva/${visitId}`, {
      headers 
    });

    // Handle 304 Not Modified (use cached data)
    if (res.status === 304) {
      console.log(`✅ SEVA for visit ${visitId} not modified, using cache`);
      return cachedSeva[visitId] ?? null;
    }

    if (!res.ok) {
      if (res.status === 404) {
        cachedSeva[visitId] = null;
        cachedETags[visitId] = res.headers.get("ETag") || "";
        return null;
      }
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    // If backend returns null/empty
    if (!json) {
      cachedSeva[visitId] = null;
      cachedETags[visitId] = res.headers.get("ETag") || "";
      return null;
    }

    // Normalize backend (snake_case → camelCase)
    const data: Seva = {
      leftWithPinholeNew: json.left_with_pinhole_new,
      rightWithPinholeNew: json.right_with_pinhole_new,
      leftWithoutPinholeNew: json.left_without_pinhole_new,
      rightWithoutPinholeNew: json.right_without_pinhole_new,
      diagnosis: json.diagnosis,
      dateOfReferral: json.date_of_referral,
      notes: json.notes ?? "",
    };

    // Update cache and ETag
    cachedSeva[visitId] = data;
    cachedETags[visitId] = res.headers.get("ETag") || "";

    return data;

  } catch (err) {
    console.error("GET SEVA (Error):", err);

    // Fallback to cached data if available
    if (cachedSeva[visitId] !== undefined) {
      console.warn(`⚠️ Returning cached SEVA for visit ${visitId} due to fetch failure.`);
      return cachedSeva[visitId];
    }

    return null;
  }
}
