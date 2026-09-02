import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { Drug, PharmacyStats } from "@/lib/types/drug";

type AddDrugPayload = {
    location_id: number;
    drug_name: string;
    stock_count: number;
};

const cachedDrugs: Record<number, Drug[]> = {};
const cachedETags: Record<number, string> = {};

export function clearPharmacyCache() {
  Object.keys(cachedDrugs).forEach(key => delete cachedDrugs[Number(key)]);
  Object.keys(cachedETags).forEach(key => delete cachedETags[Number(key)]);
}

// Invalidate just one location's cached drug list when we know it; otherwise
// fall back to clearing everything.
function invalidatePharmacyCache(locationId?: number) {
  if (locationId === undefined) {
    clearPharmacyCache();
    return;
  }
  delete cachedDrugs[locationId];
  delete cachedETags[locationId];
}

export async function getDrugsByLocation(locationId: number): Promise<Drug[]> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
    };

    if (cachedETags[locationId]) {
        headers['If-None-Match'] = cachedETags[locationId];
    }

    const res = await fetch(`${backend_url}/api/pharmacy?location_id=${locationId}`, {
        cache: "no-cache",
        headers
    });

    if (res.status === 304) {
        if (cachedDrugs[locationId]) {
            return cachedDrugs[locationId];
        }
        const freshRes = await fetch(`${backend_url}/api/pharmacy?location_id=${locationId}`, {
            cache: "no-cache",
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!freshRes.ok) throw new Error('Failed to fetch pharmacy stock');
        const freshData: Drug[] = await freshRes.json();
        cachedDrugs[locationId] = freshData;
        cachedETags[locationId] = freshRes.headers.get('ETag') || '';
        return freshData;
    }

    if (!res.ok) throw new Error('Failed to fetch pharmacy stock');

    const data: Drug[] = await res.json();

    cachedDrugs[locationId] = data;
    cachedETags[locationId] = res.headers.get('ETag') || '';

    return data;
}

export async function getPharmacyStats(locationId: number): Promise<PharmacyStats> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await fetch(`${backend_url}/api/pharmacy/stats?location_id=${locationId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch pharmacy stats');
    return res.json();
}

export async function addDrug(drugData: AddDrugPayload): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await fetch(`${backend_url}/api/pharmacy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(drugData),
    });
    if (!res.ok) throw new Error('Failed to add drug');

    invalidatePharmacyCache(drugData.location_id);
    return res.json();
}

export async function dispenseDrug(
    drugId: number,
    quantity: number,
    opts: { visitId?: number; locationId?: number } = {}
): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}/dispense`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity, visit_id: opts.visitId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
            throw new Error(
                err.available !== undefined
                    ? `Only ${err.available} in stock.`
                    : 'Insufficient stock.'
            );
        }
        throw new Error(err.error || 'Failed to dispense medication');
    }

    invalidatePharmacyCache(opts.locationId);
    return res.json();
}

export async function updateDrugCount(drugId: number, stockCount: number, locationId?: number): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ stock_count: stockCount }),
    });
    if (!res.ok) throw new Error('Failed to update drug stock');

    invalidatePharmacyCache(locationId);
    return res.json();
}

export async function updateDrugName(drugId: number, drugName: string, locationId?: number): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}/name`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ drug_name: drugName }),
    });
    if (!res.ok) throw new Error('Failed to update drug name');

    invalidatePharmacyCache(locationId);
    return res.json();
}

export async function deleteDrug(drugId: number, locationId?: number): Promise<void> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete drug');

    invalidatePharmacyCache(locationId);
}
