import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";

async function saveData(endpoint: string, data: any) {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await fetch(`${backend_url}/api/triage/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || `Failed to save ${endpoint} data.`);
    }
    return res.json();
}


export const saveVisualAcuity = (data: any) => saveData('visual-acuity', data);
export const savePresentingComplaint = (data: any) => saveData('presenting-complaint', data);
export const saveMedicalHistory = (data: any) => saveData('history', data);

async function loadOne(path: string, patientId: number, visitId: number) {
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await fetch(
        `${backend_url}/api/visits/${path}/${patientId}/${visitId}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load ${path} data.`);
    return res.json();
}

// Fetch any triage records already saved for this visit, so the editing form
// shows what's there instead of a blank slate (which a re-save would persist).
export async function loadTriage(patientId: number, visitId: number) {
    const [visualAcuity, presentingComplaint, medicalHistory] = await Promise.all([
        loadOne('visual-acuity', patientId, visitId),
        loadOne('presenting-complaint', patientId, visitId),
        loadOne('history', patientId, visitId),
    ]);
    return { visualAcuity, presentingComplaint, medicalHistory };
}