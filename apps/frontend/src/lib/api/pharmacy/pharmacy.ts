import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { Drug } from "@/lib/types/drug";

type AddDrugPayload = Omit<Drug, 'id' | 'last_updated_at' | 'last_updated_by' | 'created_at'>;

// Cache for drugs per location
const cachedDrugs: Record<number, Drug[]> = {};
const cachedETags: Record<number, string> = {};

/**
 * Fetches all drugs for a given location with ETag caching.
 */
export async function getDrugsByLocation(locationId: number): Promise<Drug[]> {
    const token = useUserStore.getState().user?.token;
    const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
    };

    // Add If-None-Match header if we have an ETag for this location
    if (cachedETags[locationId]) {
        headers['If-None-Match'] = cachedETags[locationId];
    }

    const res = await fetch(`${backend_url}/api/pharmacy?location_id=${locationId}`, {
        cache: "no-cache",
        headers 
    });

    if (res.status === 304 && cachedDrugs[locationId]) {
        console.log(`✅ Drugs for location ${locationId} not modified, using cache`);
        return cachedDrugs[locationId];
    }

    if (!res.ok) throw new Error('Failed to fetch pharmacy stock');

    const data: Drug[] = await res.json();

    // Update cache and ETag
    cachedDrugs[locationId] = data;
    cachedETags[locationId] = res.headers.get('ETag') || '';

    return data;
}

/**
 * Adds a new drug to the pharmacy stock and invalidates cache.
 */
export async function addDrug(drugData: AddDrugPayload): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    const res = await fetch(`${backend_url}/api/pharmacy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(drugData),
    });
    if (!res.ok) throw new Error('Failed to add drug');

    // Invalidate cache for the drug's location
    if (drugData.location_id) delete cachedDrugs[drugData.location_id];
    return res.json();
}

/**
 * Updates the stock level of an existing drug and invalidates cache.
 */
export async function updateDrugStock(
    drugId: number, 
    stockLevel: Drug['stock_level']
): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ stock_level: stockLevel }),
    });
    if (!res.ok) throw new Error('Failed to update drug stock');

    // Optional: invalidate all caches (or per location if you track location of drug)
    Object.keys(cachedDrugs).forEach(key => delete cachedDrugs[parseInt(key)]);

    return res.json();
}

/**
 * Deletes a drug from the pharmacy stock and invalidates cache.
 */
export async function deleteDrug(drugId: number): Promise<void> {
    const token = useUserStore.getState().user?.token;
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete drug');

    // Optional: invalidate all caches
    Object.keys(cachedDrugs).forEach(key => delete cachedDrugs[parseInt(key)]);
}
