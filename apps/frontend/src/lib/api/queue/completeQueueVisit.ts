import { backend_url } from "@/constants/env_variable";
import { clearQueueCache } from "./getQueue";
import { apiFetch, readError } from "@/lib/api/request";

export async function completeQueueVisit(visitId: number, token: string): Promise<void> {
  const res = await apiFetch(`${backend_url}/api/queue/${visitId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(await readError(res, "Failed to remove patient from queue"));
  }

  clearQueueCache();
}
