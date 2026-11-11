import { invalidateConsultation } from "./doctors-consultation/getConsultation";
import { backend_url } from "@/constants/env_variable";
import { Referral } from "@/lib/types/consultation";
import { useUserStore } from "@/stores/useUserStore";
import { apiFetch } from "@/lib/api/request";
import { expectedVersion, noteVersion, saveError } from "@/lib/api/recordVersions";

export async function postReferral(data: Referral, visitId: number) {
  if (!visitId) throw new Error("visitId is required");

  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");

  let modifiedTypes = ""
  data.referralType.forEach((item) => {
    modifiedTypes += item + "\n"
  });


  const res = await apiFetch(`${backend_url}/api/visits/referral/${visitId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      referralDate: data.referralDate,
      referralType: modifiedTypes,
      illness: data.illness,
      duration: data.duration,
      reason: data.reason,
      signature: data.signature ?? null,
      doctorName: data.doctorName ?? "",
      ...expectedVersion("referral", visitId),
    }),
  });

  if (!res.ok) throw await saveError(res, "referral", visitId, "Failed to save referral");

  invalidateConsultation(visitId);
  const saved = await res.json();
  noteVersion("referral", visitId, saved.last_updated_at);
  // Saving a referral also marks the consult notes as needing one, which changes their version.
  if (saved.consultation_updated_at) noteVersion("consultation", visitId, saved.consultation_updated_at);
  return saved;
}
