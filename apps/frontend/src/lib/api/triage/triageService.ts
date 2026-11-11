import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { apiFetch } from "@/lib/api/request";
import { expectedVersion, noteVersion, saveError } from "@/lib/api/recordVersions";

async function saveData(endpoint: string, data: any) {
    const visitId = Number(data.visit_id);
    const token = useUserStore.getState().user?.token;
    if (!token) throw new Error("User not authenticated");
    const res = await apiFetch(`${backend_url}/api/triage/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data, ...expectedVersion(endpoint, visitId) }),
    });

    if (!res.ok) throw await saveError(res, endpoint, visitId, `Failed to save ${endpoint} data.`);
    const saved = await res.json();
    noteVersion(endpoint, visitId, saved.last_updated_at);
    return saved;
}


export const saveVisualAcuity = (data: any) => saveData('visual-acuity', data);
export const savePresentingComplaint = (data: any) => saveData('presenting-complaint', data);
export const saveMedicalHistory = (data: any) => saveData('history', data);
/** Fresh reads distinguish a missing record from a failed request before enabling first entry. */
export async function getTriageRecord<T>(section: string, patientId: number, visitId: number): Promise<T | null> {
  const token = useUserStore.getState().user?.token;
  const res = await apiFetch(`${backend_url}/api/visits/${section}/${patientId}/${visitId}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (res.status === 404) {
    noteVersion(section, visitId, null);
    return null;
  }
  if (!res.ok) throw new Error("Unable to load saved triage data. Please retry.");
  const record = await res.json();
  noteVersion(section, visitId, record?.last_updated_at);
  return record;
}
