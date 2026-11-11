import { invalidateConsultation } from "./getConsultation";
import { backend_url } from "@/constants/env_variable";
import { Consultation } from "@/lib/types/consultation";
import { useUserStore } from "@/stores/useUserStore";
import { apiFetch } from "@/lib/api/request";
import { expectedVersion, noteVersion, saveError } from "@/lib/api/recordVersions";

export async function postConsultation(data: Consultation, visitId: number) {
  if (!visitId) throw new Error("visitId is required");

  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");

  const res = await apiFetch(`${backend_url}/api/visits/consultation/${visitId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      notes: data.notes,
      condition_categories: data.conditionCategories,
      prescription: data.prescription,
      require_referral: data.requireReferral,
      ...expectedVersion("consultation", visitId),
    }),
  });

  if (!res.ok) throw await saveError(res, visitId, "Failed to save consultation");
  invalidateConsultation(visitId);
  const saved = await res.json();
  noteVersion("consultation", visitId, saved.last_updated_at);
  return saved;
}
