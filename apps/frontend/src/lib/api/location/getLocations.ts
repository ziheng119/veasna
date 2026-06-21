import { backend_url } from "@/constants/env_variable";
import { Location } from "@/lib/types/location";

let cachedLocations: Location[] | null = null;
let lastETag: string | null = null; // store last ETag

export async function getLocations(): Promise<Location[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Add If-None-Match header if we have an ETag
    const headers: HeadersInit = {};
    if (lastETag) {
      headers["If-None-Match"] = lastETag;
    }

    const res = await fetch(`${backend_url}/api/locations`, {
      method: "GET",
      cache: "no-cache",
      headers,
      next: { revalidate: 3600 }, // optional Next.js server cache
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 304 && cachedLocations) {
      // Data hasn't changed; return cached
      console.log("✅ Locations not modified, using cached data");
      return cachedLocations;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch locations: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    // Validate and extract data safely
    const data: Location[] = Array.isArray(json.locations) ? json.locations : [];
    console.log("✅ GET Locations (Success):", data.length);

    // Cache the result and save new ETag
    cachedLocations = data;
    lastETag = res.headers.get("ETag");

    return data;
  } catch (err: any) {
    console.error("❌ GET Locations (Error):", err?.message || err);

    // Fallback to cached data if available
    if (cachedLocations) {
      console.warn("⚠️ Returning cached locations due to fetch failure.");
      return cachedLocations;
    }

    return [];
  }
}
