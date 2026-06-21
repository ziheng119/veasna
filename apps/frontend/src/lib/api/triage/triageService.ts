import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";

async function saveData(endpoint: string, data: any) {
    const token = useUserStore.getState().user?.token;
    const res = await fetch(`${backend_url}/api/triage/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to save ${endpoint} data.`);
    }
    return res.json();
}


export const saveVisualAcuity = (data: any) => saveData('visual-acuity', data);
export const savePresentingComplaint = (data: any) => saveData('presenting-complaint', data);
export const saveMedicalHistory = (data: any) => saveData('history', data);