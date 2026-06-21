import { backend_url } from "@/constants/env_variable";
import { Physiotherapy } from "@/lib/types/physiotherapy";
import { useUserStore } from "@/stores/useUserStore";

/**
 * Post or update physiotherapy notes and painpoints for a visit
 */
export async function postPhysiotherapy(
  data: Physiotherapy,
  visitId: number,
) {
  if (!visitId) throw new Error("visitId is required");
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");

  const res = await fetch(`${backend_url}/api/visits/physiotherapy/${visitId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      notes: data.notes,
      painpoints: data.painpoints,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save physiotherapy: ${res.status} ${text}`);
  }

  return res.json();
}
