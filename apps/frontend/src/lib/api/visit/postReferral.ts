import { backend_url } from "@/constants/env_variable";
import { Referral } from "@/lib/types/consultation";
import { useUserStore } from "@/stores/useUserStore";

export async function postReferral(data: Referral, visitId: number) {
  if (!visitId) throw new Error("visitId is required");

  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");

  let modifiedTypes = ""
  data.referralType.forEach((item) => {
    modifiedTypes += item + "\n"
  });


  const res = await fetch(`${backend_url}/api/visits/referral/${visitId}`, {
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
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save referral: ${res.status} ${text}`);
  }

  return res.json();
}
