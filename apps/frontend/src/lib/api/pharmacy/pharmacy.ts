import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { Drug, PharmacyStats } from "@/lib/types/drug";
import { apiFetch, readError } from "@/lib/api/request";

type AddDrugPayload = {
    drug_name: string;
    stock_count: number;
};

// The last drug list, so a dropped connection still shows it and an unchanged list is a 304.
let cachedDrugs: Drug[] | null = null;
let cachedETag = "";

export function clearPharmacyCache() {
  cachedDrugs = null;
  cachedETag = "";
}

export async function getDrugs(): Promise<Drug[]> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
    };

    if (cachedETag) {
        headers['If-None-Match'] = cachedETag;
    }

    const res = await apiFetch(`${backend_url}/api/pharmacy`, {
        cache: "no-cache",
        headers
    });

    if (res.status === 304) {
        if (cachedDrugs) {
            return cachedDrugs;
        }
        const freshRes = await apiFetch(`${backend_url}/api/pharmacy`, {
            cache: "no-cache",
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!freshRes.ok) throw new Error('Failed to fetch pharmacy stock');
        const freshData: Drug[] = await freshRes.json();
        cachedDrugs = freshData;
        cachedETag = freshRes.headers.get('ETag') || '';
        return freshData;
    }

    if (!res.ok) throw new Error('Failed to fetch pharmacy stock');

    const data: Drug[] = await res.json();

    cachedDrugs = data;
    cachedETag = res.headers.get('ETag') || '';

    return data;
}

export async function getPharmacyStats(): Promise<PharmacyStats> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await apiFetch(`${backend_url}/api/pharmacy/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch pharmacy stats');
    return res.json();
}

export async function addDrug(drugData: AddDrugPayload): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await apiFetch(`${backend_url}/api/pharmacy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(drugData),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to add drug'));

    clearPharmacyCache();
    return res.json();
}

export async function updateDrugCount(drugId: number, stockCount: number): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await apiFetch(`${backend_url}/api/pharmacy/${drugId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ stock_count: stockCount }),
    });
    if (!res.ok) {
        // e.g. stock cannot go below what pending prescriptions have reserved
        throw new Error(await readError(res, 'Failed to update drug stock'));
    }

    clearPharmacyCache();
    return res.json();
}

// Subtracts on the server, so concurrent dispensing on several devices is never lost.
// Throws the server's message (e.g. "Only 3 left in stock") when it refuses.
// `requestId` (lib/requestId.ts): the same dispense sent again doesn't take the stock twice.
export async function dispenseDrug(drugId: number, quantity: number, requestId?: string): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await apiFetch(`${backend_url}/api/pharmacy/${drugId}/dispense`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity, request_id: requestId }),
    });
    clearPharmacyCache();
    if (!res.ok) {
        throw new Error(await readError(res, 'Failed to dispense medication.'));
    }
    return res.json();
}

export async function updateDrugName(drugId: number, drugName: string): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await apiFetch(`${backend_url}/api/pharmacy/${drugId}/name`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ drug_name: drugName }),
    });
    if (!res.ok) throw new Error('Failed to update drug name');

    clearPharmacyCache();
    return res.json();
}

export async function deleteDrug(drugId: number): Promise<void> {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await apiFetch(`${backend_url}/api/pharmacy/${drugId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
        // e.g. a drug with pending prescriptions cannot be removed
        throw new Error(await readError(res, 'Failed to delete drug'));
    }

    clearPharmacyCache();
}
