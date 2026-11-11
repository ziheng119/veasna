// The version (last_updated_at) of each station record this device last loaded or saved: Triage
// sections, Dental, partner NGO, Physiotherapy and Consult notes. Each save sends it back as
// expected_updated_at, and the host refuses the save (409) if the record was saved on another device
// since (apps/backend/utils/recordVersion.js).
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import { readError } from "./request";

const versions = new Map<string, string | null>();
const key = (record: string, visitId: number) => `${record}:${visitId}`;

// `savedAt` is the record's last_updated_at, or null while it hasn't been saved.
export function noteVersion(record: string, visitId: number, savedAt: string | null | undefined): void {
  versions.set(key(record, visitId), savedAt ?? null);
}

// What to add to a save's body: nothing when this device never loaded the record (no check).
export function expectedVersion(record: string, visitId: number): { expected_updated_at?: string | null } {
  const recordKey = key(record, visitId);
  return versions.has(recordKey) ? { expected_updated_at: versions.get(recordKey) } : {};
}

// The error for a failed save. On 409 the open form reloads the record, as after a live update, and
// offers the saved version (components/shared/LiveRecord.tsx); the next save replaces it.
export async function saveError(res: Response, visitId: number, fallback: string): Promise<Error> {
  const error = new Error(await readError(res, fallback));
  if (res.status === 409) useRealtimeStore.getState().noteVisitChanges([visitId]);
  return error;
}
