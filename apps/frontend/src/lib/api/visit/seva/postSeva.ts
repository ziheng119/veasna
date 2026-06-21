import { Seva } from "@/lib/types/seva";
import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";

export async function postSeva(data: Seva, visitId: number) {
  if (!visitId) throw new Error("visitId is required");

  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");

  const res = await fetch(`${backend_url}/api/visits/seva/${visitId}`, {
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
      diagnosis: data.diagnosis,
      date_of_referral: data.dateOfReferral,
      notes: data.notes ?? "",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save SEVA: ${res.status} ${text}`);
  }

  return res.json();
}
