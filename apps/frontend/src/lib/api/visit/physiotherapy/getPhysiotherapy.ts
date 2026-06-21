import { backend_url } from "@/constants/env_variable";
import { Physiotherapy } from "@/lib/types/physiotherapy";

const cachedPhysio: Record<number, Physiotherapy | null> = {};
const cachedETags: Record<number, string> = {};

/**
 * Fetch physiotherapy data for a given visit including painpoints.
 * Uses ETag-based caching and 304 handling.
 */
export async function getPhysiotherapy(visitId: number): Promise<Physiotherapy | null> {
  try {
    const headers: HeadersInit = {};

    if (cachedETags[visitId]) {
      headers["If-None-Match"] = cachedETags[visitId];
    }

    const res = await fetch(`${backend_url}/api/visits/physiotherapy/${visitId}`, { headers });

    if (res.status === 304) {
      console.log(`✅ Physiotherapy for visit ${visitId} not modified, using cache`);
      return cachedPhysio[visitId] ?? null;
    }

    if (!res.ok) {
      if (res.status === 404) {
        cachedPhysio[visitId] = null;
        cachedETags[visitId] = res.headers.get("ETag") || "";
        return null;
      }
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    if (!json) {
      cachedPhysio[visitId] = null;
      cachedETags[visitId] = res.headers.get("ETag") || "";
      return null;
    }

    const data: Physiotherapy = {
      notes: json.notes ?? "",
      painpoints: (json.painpoints || []).map((pp: any) => ({
        xCoord: pp.xCoord,
        yCoord: pp.yCoord,
      })),
    };

    cachedPhysio[visitId] = data;
    cachedETags[visitId] = res.headers.get("ETag") || "";

    console.log(data.painpoints)

    return data;

  } catch (err) {
    console.error("GET PhysiotherapyWithPainpoints (Error):", err);
    if (cachedPhysio[visitId] !== undefined) {
      console.warn(`⚠️ Returning cached physiotherapy for visit ${visitId} due to fetch failure.`);
      return cachedPhysio[visitId];
    }
    return null;
  }
}