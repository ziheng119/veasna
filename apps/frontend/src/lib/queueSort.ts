import { QueuedPatient } from "@/lib/types/patient";
import { compareQueueNumbers } from "@/lib/queueNumber";

export type QueueSortMode = "number" | "arrival";
export const isQueueSortMode = (value: unknown): value is QueueSortMode => value === "number" || value === "arrival";

export function sortQueuePatients(patients: QueuedPatient[], mode: QueueSortMode): QueuedPatient[] {
  // API order is authoritative for arrival, including its visit-ID tie breaker.
  // Never parse the display clock or mutate data shared with another component.
  // The sort is stable, so equal numbers keep arrival order.
  const result = [...patients];
  return mode === "arrival" ? result : result.sort((a, b) => compareQueueNumbers(a.queue_no, b.queue_no));
}
