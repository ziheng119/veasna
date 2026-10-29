import { backend_url } from "@/constants/env_variable";
import { parseReferralDestinations } from "@/constants/referral";
import formatDate from "@/helper/format_date";
import { Consultation, Referral } from "@/lib/types/consultation";
import { useUserStore } from "@/stores/useUserStore";

// Cache for consultation per visitId
const cachedConsultation: Record<number, Consultation | null> = {};
const cachedETags: Record<number, string> = {};

export function invalidateConsultation(visitId: number) {
  delete cachedConsultation[visitId];
  delete cachedETags[visitId];
}

/**
 * Fetch consultation + referral data for a given visit.
 * Uses ETag-based caching and 304 handling.
 */
export async function getConsultation(visitId: number): Promise<Consultation | null> {
  try {
    const token = useUserStore.getState().user?.token;
    const headers: HeadersInit = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

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
      const modified_types = parseReferralDestinations(json.referral_type);

      modified_referral = { 
        referralDate: json.referral_date ? formatDate(json.referral_date) : "",
        referralType: modified_types,
        illness: json.illness,
        duration: json.duration,
        signature: json.signature ?? null,
        signerName: json.signer_name,
        signerId: json.signer_id,
        signedAt: json.signed_at,
        reason: json.reason
      }
    }

    // Normalize backend snake_case → camelCase
    const data: Consultation = {
      hasSavedNotes: json.id != null,
      conditionCategories: json.condition_categories ?? null,
      notes: json.notes ?? "",
      prescription: json.prescription ?? "",
      requireReferral: json.require_referral ?? modified_referral !== null,
      referral:  modified_referral
    };

    // Update cache + ETag
    cachedConsultation[visitId] = data;
    cachedETags[visitId] = res.headers.get("ETag") || "";

    return data;
  } catch (err) {
    console.error("GET Consultation (Error):", err);

    // An unavailable record must not be mistaken for a new/empty consultation.
    throw err;
  }
}
