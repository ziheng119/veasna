import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { invalidateConsultation } from "./doctors-consultation/getConsultation";
import { apiFetch, readError } from "@/lib/api/request";
import { noteVersion } from "@/lib/api/recordVersions";

export async function deleteReferral(visitId: number): Promise<void> {
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");
  const response = await apiFetch(`${backend_url}/api/visits/referral/${visitId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await readError(response, "Unable to delete referral"));
  invalidateConsultation(visitId);
  noteVersion("referral", visitId, null);
  // Deleting also clears the consult notes' referral flag, which changes their version.
  const { consultation_updated_at: notesVersion } = await response.json().catch(() => ({}));
  if (notesVersion) noteVersion("consultation", visitId, notesVersion);
}
