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

export async function getDrugsByLocation(locationId: number): Promise<Drug[]> {
    const token = useUserStore.getState().user?.token;
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
    const res = await fetch(`${backend_url}/api/pharmacy/stats?location_id=${locationId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch pharmacy stats');
    return res.json();
}

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

    if (drugData.location_id) {
        delete cachedDrugs[drugData.location_id];
        delete cachedETags[drugData.location_id];
    }
    return res.json();
}

export async function updateDrugCount(drugId: number, stockCount: number): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ stock_count: stockCount }),
    });
    if (!res.ok) throw new Error('Failed to update drug stock');

    Object.keys(cachedDrugs).forEach(key => { delete cachedDrugs[parseInt(key)]; delete cachedETags[parseInt(key)]; });
    return res.json();
}

export async function updateDrugName(drugId: number, drugName: string): Promise<Drug> {
    const token = useUserStore.getState().user?.token;
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}/name`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ drug_name: drugName }),
    });
    if (!res.ok) throw new Error('Failed to update drug name');

    Object.keys(cachedDrugs).forEach(key => { delete cachedDrugs[parseInt(key)]; delete cachedETags[parseInt(key)]; });
    return res.json();
}

export async function deleteDrug(drugId: number): Promise<void> {
    const token = useUserStore.getState().user?.token;
    const res = await fetch(`${backend_url}/api/pharmacy/${drugId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete drug');

    Object.keys(cachedDrugs).forEach(key => { delete cachedDrugs[parseInt(key)]; delete cachedETags[parseInt(key)]; });
}
