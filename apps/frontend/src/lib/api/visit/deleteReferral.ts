import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { invalidateConsultation } from "./doctors-consultation/getConsultation";

export async function deleteReferral(visitId: number): Promise<void> {
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");
  const response = await fetch(`${backend_url}/api/visits/referral/${visitId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to delete referral. Please try again.");
  invalidateConsultation(visitId);
}
