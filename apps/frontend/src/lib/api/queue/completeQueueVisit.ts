import { backend_url } from "@/constants/env_variable";
import { clearQueueCache } from "./getQueue";

export async function completeQueueVisit(visitId: number, token: string): Promise<void> {
  const res = await fetch(`${backend_url}/api/queue/${visitId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Failed to remove patient from queue");
  }

  clearQueueCache();
}
