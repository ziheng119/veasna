import { backend_url } from "@/constants/env_variable";
import { clearQueueCache } from "./queue/getQueue";

// Families share a letter on their queue numbers, e.g. 3A, 4A, 5A (apps/backend/routes/family.js).

async function post<T>(path: string, body: object, token: string): Promise<T> {
  const res = await fetch(`${backend_url}/api/family${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Failed to update the family");
  }
  clearQueueCache();
  return res.json();
}

// Puts the visit in withVisitId's family, or starts a new family for both. Resolves to the new numbers.
export function joinFamily(visitId: number, withVisitId: number, token: string) {
  return post<{ family: string; visits: { visit_id: number; queue_no: string }[] }>(
    "", { visit_id: visitId, with_visit_id: withVisitId }, token);
}

// Takes the visit out of its family (4A becomes 4). Resolves to the new number.
export function leaveFamily(visitId: number, token: string) {
  return post<{ visit_id: number; queue_no: string }>("/leave", { visit_id: visitId }, token);
}
