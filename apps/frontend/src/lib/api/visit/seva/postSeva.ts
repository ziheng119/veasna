import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { Seva } from "@/lib/types/seva";
import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { apiFetch } from "@/lib/api/request";
import { expectedVersion, noteVersion, saveError } from "@/lib/api/recordVersions";

export async function postSeva(data: Seva, visitId: number) {
  if (!visitId) throw new Error("visitId is required");

  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");

  const res = await apiFetch(`${backend_url}/api/visits/seva/${visitId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      left_with_pinhole_new: data.leftWithPinholeNew,
      right_with_pinhole_new: data.rightWithPinholeNew,
      left_without_pinhole_new: data.leftWithoutPinholeNew,
      right_without_pinhole_new: data.rightWithoutPinholeNew,
      left_with_glasses_new: data.leftWithGlassesNew,
      right_with_glasses_new: data.rightWithGlassesNew,
      diagnosis: data.diagnosis,
      date_of_referral: data.dateOfReferral,
      referral: data.referral || null,
      notes: data.notes ?? "",
      ...expectedVersion("seva", visitId),
    }),
  });

  if (!res.ok) throw await saveError(res, visitId, `Failed to save ${PARTNER_NGO_NAME} notes`);
  const saved = await res.json();
  noteVersion("seva", visitId, saved.last_updated_at);
  return saved;
}
