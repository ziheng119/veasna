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
        throw new Error(error.error || error.message || `Failed to save ${endpoint} data.`);
    }
    return res.json();
}


export const saveVisualAcuity = (data: any) => saveData('visual-acuity', data);
export const savePresentingComplaint = (data: any) => saveData('presenting-complaint', data);
export const saveMedicalHistory = (data: any) => saveData('history', data);
/** Fresh reads distinguish a missing record from a failed request before enabling first entry. */
export async function getTriageRecord<T>(section: string, patientId: number, visitId: number): Promise<T | null> {
  const token = useUserStore.getState().user?.token;
  const res = await fetch(`${backend_url}/api/visits/${section}/${patientId}/${visitId}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Unable to load saved triage data. Please retry.");
  return res.json();
}
