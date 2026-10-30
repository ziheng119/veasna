import { backend_url } from "@/constants/env_variable";
import { TbStatus } from "@/constants/tb";
import { clearQueueCache } from "../queue/getQueue";

export interface TbScreening {
  visit_id: number;
  red_flags: string[];
  flag_notes: string;
  status: TbStatus;
  flagged: boolean;
  doctor_notes: string;
  flagged_at: string;
  flagged_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// TB screening for a visit, or null when the visit was never flagged.
export async function getTbScreening(visitId: number, token: string): Promise<TbScreening | null> {
  const res = await fetch(`${backend_url}/api/tb/${visitId}`, {
    cache: "no-cache",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to load TB flag");
  }
  return res.json();
}

// Flags (or, for admins, unflags) the visit for suspected TB.
export async function setTbFlag(
  visitId: number,
  flag: { flagged: boolean; red_flags?: string[]; notes?: string },
  token: string
): Promise<{ flagged: boolean; status?: TbStatus }> {
  const res = await fetch(`${backend_url}/api/tb/${visitId}/flag`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(flag),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Failed to update TB flag");
  }
  clearQueueCache();
  return res.json();
}
