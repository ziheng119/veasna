import { backend_url } from "@/constants/env_variable";
import { Physiotherapy } from "@/lib/types/physiotherapy";
import { useUserStore } from "@/stores/useUserStore";
import { apiFetch } from "@/lib/api/request";
import { expectedVersion, noteVersion, saveError } from "@/lib/api/recordVersions";

const cachedPhysio: Record<number, Physiotherapy | null> = {};
const cachedETags: Record<number, string> = {};

/**
 * Fetch physiotherapy data for a given visit including painpoints.
 * Uses ETag-based caching and 304 handling.
 */
export async function getPhysiotherapy(visitId: number): Promise<Physiotherapy | null> {
  try {
    const token = useUserStore.getState().user?.token;
    const headers: HeadersInit = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (cachedETags[visitId]) {
      headers["If-None-Match"] = cachedETags[visitId];
    }

    const res = await apiFetch(`${backend_url}/api/visits/physiotherapy/${visitId}`, { headers });

    if (res.status === 304) {
      console.log(`✅ Physiotherapy for visit ${visitId} not modified, using cache`);
      return cachedPhysio[visitId] ?? null;
    }

    if (!res.ok) {
      if (res.status === 404) {
        noteVersion("physiotherapy", visitId, null);
        cachedPhysio[visitId] = null;
        cachedETags[visitId] = res.headers.get("ETag") || "";
        return null;
      }
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    noteVersion("physiotherapy", visitId, json?.lastUpdatedAt);

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

    return data;

  } catch (err) {
    // A failed load must not be treated as a new record that can be edited.
    throw err;
  }
}
