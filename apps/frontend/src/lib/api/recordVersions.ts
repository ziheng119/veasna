// The version (last_updated_at) of each station record this device last loaded or saved: Triage
// sections, Dental, partner NGO, Physiotherapy, Consult notes and the referral. Each save sends it back as
// expected_updated_at, and the host refuses the save (409) if the record was saved on another device
// since (apps/backend/utils/recordVersion.js).
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import { readError } from "./request";

const versions = new Map<string, string | null>();
// Saves sent and not answered yet. One that never got an answer (Wi-Fi dropped) may have been saved
// by the host, which changed the version, so trying it again sends no check: otherwise this device's
// own save would be refused as "saved on another device".
const unanswered = new Set<string>();
const key = (record: string, visitId: number) => `${record}:${visitId}`;

// `savedAt` is the record's last_updated_at, or null while it hasn't been saved.
export function noteVersion(record: string, visitId: number, savedAt: string | null | undefined): void {
  const recordKey = key(record, visitId);
  unanswered.delete(recordKey);
  versions.set(recordKey, savedAt ?? null);
}

// What to add to a save's body: nothing when this device never loaded the record, or its last save
// of it got no answer (no check, so the later save is kept).
export function expectedVersion(record: string, visitId: number): { expected_updated_at?: string | null } {
  const recordKey = key(record, visitId);
  const lastUnanswered = unanswered.has(recordKey);
  unanswered.add(recordKey);
  return versions.has(recordKey) && !lastUnanswered ? { expected_updated_at: versions.get(recordKey) } : {};
}

// The error for a save the host refused. On 409 the open form reloads the record, as after a live
// update, and offers the saved version (components/shared/LiveRecord.tsx); the next save replaces it.
export async function saveError(res: Response, record: string, visitId: number, fallback: string): Promise<Error> {
  // Answered, so not saved: the next attempt is checked again.
  unanswered.delete(key(record, visitId));
  const error = new Error(await readError(res, fallback));
  if (res.status === 409) useRealtimeStore.getState().noteVisitChanges([visitId]);
  return error;
}
