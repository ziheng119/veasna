import { backend_url } from "@/constants/env_variable";
import { clearQueueCache } from "./queue/getQueue";

// Families: patients who come together share a letter (patients.family), apart from their queue
// numbers (apps/backend/routes/family.js). A family always has at least two members.

async function post<T>(path: string, body: object, token: string): Promise<T> {
  const res = await fetch(`${backend_url}/api/family${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Failed to update the family");
  }
  clearQueueCache();
  return res.json();
}

// Puts the patient in withPatientId's family, or starts a new family of the two when that patient
// has none. Resolves to the family letter.
export function joinFamily(patientId: number, withPatientId: number, token: string) {
  return post<{ family: string; patients: { patient_id: number; family: string }[] }>(
    "", { patient_id: patientId, with_patient_id: withPatientId }, token);
}

// Takes the patient out of their family; a family left with one member is dissolved.
export function leaveFamily(patientId: number, token: string) {
  return post<{ patient_id: number; family: null }>("/leave", { patient_id: patientId }, token);
}
