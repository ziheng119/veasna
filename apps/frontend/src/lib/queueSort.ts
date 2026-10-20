import { QueuedPatient } from "@/lib/types/patient";

export type QueueSortMode = "number" | "arrival";
export const isQueueSortMode = (value: unknown): value is QueueSortMode => value === "number" || value === "arrival";

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareQueueNumbers(a: string, b: string) {
  const left = /^(\d+)([A-Z]*)$/.exec(a.trim().toUpperCase());
  const right = /^(\d+)([A-Z]*)$/.exec(b.trim().toUpperCase());
  if (!left || !right) return left ? -1 : right ? 1 : compareText(a, b);
  // Compare digits without numeric conversion, then suffixes: 2, 2A, 2AA, 2B, 10.
  const x = left[1].replace(/^0+(?=\d)/, "");
  const y = right[1].replace(/^0+(?=\d)/, "");
  return x.length - y.length || compareText(x, y) || compareText(left[2], right[2]);
}

export function sortQueuePatients(patients: QueuedPatient[], mode: QueueSortMode): QueuedPatient[] {
  // API order is authoritative for arrival, including its visit-ID tie breaker.
  // Never parse the display clock or mutate data shared with another component.
  const result = [...patients];
  return mode === "arrival" ? result : result.sort((a, b) => compareQueueNumbers(a.queue_no, b.queue_no));
}
