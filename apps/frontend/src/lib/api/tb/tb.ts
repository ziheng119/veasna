import { backend_url } from "@/constants/env_variable";
import { StationId } from "@/constants/stations";
import { TbStatus } from "@/constants/tb";
import { clearQueueCache } from "../queue/getQueue";

export interface TbScreening {
  visit_id: number;
  red_flags: string[];
  flag_notes: string;
  status: TbStatus;
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
    throw new Error(error.error || "Failed to load TB screening");
  }
  return res.json();
}

export type TbDecision = Exclude<TbStatus, "suspected">;

// Records the TB doctor's decision. "cleared" moves the patient to their next station.
export async function reviewTb(
  visitId: number,
  decision: TbDecision,
  doctorNotes: string,
  token: string
): Promise<{ status: TbDecision; next_station: StationId | null; visit_completed: boolean }> {
  const res = await fetch(`${backend_url}/api/tb/${visitId}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ decision, doctor_notes: doctorNotes }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to save TB decision");
  }
  clearQueueCache();
  return res.json();
}
