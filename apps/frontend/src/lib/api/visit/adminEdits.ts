import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { VisitHef, VisitTb, VisitVitals } from "@/lib/types/visit";

// Admin-only corrections to a saved visit (apps/backend/routes/visitEdits.js).
// Station notes are corrected through their usual save functions (postSeva, postConsultation, ...).

async function adminPut<T>(path: string, body: unknown): Promise<T> {
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");

  const res = await fetch(`${backend_url}/api/visits/${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface VisitDetailsUpdate {
  queue_no: string;
  visit_date: string; // YYYY-MM-DD
  location_id: number;
}

export function updateVisitDetails(visitId: number, details: VisitDetailsUpdate) {
  return adminPut(`${visitId}`, details);
}

// Either section may be sent alone; a missing record is created.
export function updateVisitVitals(
  visitId: number,
  update: { vitals?: VisitVitals; hef?: VisitHef },
) {
  return adminPut(`${visitId}/vitals`, update);
}

// The result (status) can only change here once the visit is completed; the API returns 409
// while the patient is still in the clinic.
export function updateVisitTb(
  visitId: number,
  update: Partial<Pick<VisitTb, "red_flags" | "flag_notes" | "doctor_notes" | "status">>,
) {
  return adminPut(`${visitId}/tb`, update);
}
