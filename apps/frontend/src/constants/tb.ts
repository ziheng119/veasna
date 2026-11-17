// Suspected TB is a flag on the visit, set at registration or triage. A flagged patient goes only
// to the Consult queue (TB_STATIONS) and is marked in red ("TB") in every queue. The doctor who sees
// them can clear the flag; finishing Consult leaves their prescriptions at Pharmacy. Their stations
// can't be changed. A patient is flagged only with TB_MIN_RED_FLAGS or more red flags ticked.
// The red flags themselves are an editable list (Station data page, useFormOptions("tb_red_flags"));
// these built-in ones are used until it loads.
import formOptions from "../../../../shared/formOptions.json";

export const TB_RED_FLAGS: readonly { id: string; label: string }[] = formOptions.tb_red_flags;

import type { StationId } from "./stations";

// The only station a TB patient goes to. Must match TB_ROUTE in apps/backend/utils/tb.js.
export const TB_STATIONS: StationId[] = ["consultation"];
export const TB_ROUTE_LOCKED_HINT = "Suspected TB patients only go to Consult, so their stations can't be changed.";

// Must match TB_MIN_RED_FLAGS in apps/backend/utils/tb.js.
export const TB_MIN_RED_FLAGS = 3;

export function meetsTbThreshold(redFlags: readonly string[]): boolean {
  return redFlags.length >= TB_MIN_RED_FLAGS;
}

// Shown under the red flag checkboxes while fewer than TB_MIN_RED_FLAGS are ticked.
export function tbThresholdHint(count: number): string {
  return `${count} of ${TB_MIN_RED_FLAGS} red flags ticked. The patient is flagged for suspected TB only with ${TB_MIN_RED_FLAGS} or more.`;
}

// At registration, red flags below the threshold are still saved, as noted symptoms.
export function tbObservedHint(count: number): string {
  return `${count} of ${TB_MIN_RED_FLAGS} red flags ticked: saved as noted symptoms, and Triage sees them. With ${TB_MIN_RED_FLAGS} or more, the patient is flagged for suspected TB.`;
}

export function tbRedFlagLabel(id: string, flags: readonly { id: string; label: string }[] = TB_RED_FLAGS): string {
  return flags.find((flag) => flag.id === id)?.label ?? id;
}

// suspected: flagged. cleared: flag removed. tb_likely: flagged (older records from the former
// TB Tent, where a doctor recorded that TB was not ruled out). observed: fewer than
// TB_MIN_RED_FLAGS red flags ticked at registration, kept as a record of symptoms, not a flag
// (queues report it as tb_status null).
export type TbStatus = "suspected" | "cleared" | "tb_likely" | "observed";

export const TB_STATUS_LABELS: Record<TbStatus, string> = {
  suspected: "Suspected TB",
  cleared: "TB flag removed",
  tb_likely: "TB not ruled out",
  observed: "Red flags noted, not flagged",
};

export function isTbFlagged(status: TbStatus | null | undefined): boolean {
  return status === "suspected" || status === "tb_likely";
}
