import { backend_url } from "@/constants/env_variable";
import { Consultation } from "@/lib/types/consultation";
import { useUserStore } from "@/stores/useUserStore";

export async function postConsultation(data: Consultation, visitId: number) {
  if (!visitId) throw new Error("visitId is required");

  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");

  console.log("posting consult")

  const res = await fetch(`${backend_url}/api/visits/consultation/${visitId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      notes: data.notes,
      prescription: data.prescription,
      require_referral: data.requireReferral,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save consultation: ${res.status} ${text}`);
  }

  return res.json();
}
