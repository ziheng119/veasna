import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";

// What the dental students did, and whether the doctor should refer the patient on.
export interface DentalNotes {
  notes: string;
  referral_needed: boolean;
}

function authHeaders(): HeadersInit {
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");
  return { Authorization: `Bearer ${token}` };
}

// The visit's dental notes, or null before the first save.
export async function getDental(visitId: number, signal?: AbortSignal): Promise<DentalNotes | null> {
  const res = await fetch(`${backend_url}/api/visits/dental/${visitId}`, { cache: "no-cache", headers: authHeaders(), signal });
  if (!res.ok) throw new Error(`Failed to load dental notes (${res.status})`);
  const json = await res.json();
  return json && { notes: json.notes ?? "", referral_needed: Boolean(json.referral_needed) };
}

export async function postDental(visitId: number, data: DentalNotes): Promise<void> {
  const res = await fetch(`${backend_url}/api/visits/dental/${visitId}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to save dental notes");
  }
}
