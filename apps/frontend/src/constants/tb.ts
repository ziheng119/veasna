// Suspected TB is a flag on the visit, set at registration or triage. A flagged patient goes
// through their normal stations and is marked in red ("TB") in every queue so doctors can attend
// to them. Ticking any red flag at registration flags the patient. Update this list to match the
// red flags provided by the doctors.
export const TB_RED_FLAGS = [
  { id: "cough_2_weeks", label: "Cough for 2 weeks or more" },
  { id: "coughing_blood", label: "Coughing up blood" },
  { id: "fever", label: "Fever" },
  { id: "night_sweats", label: "Night sweats" },
  { id: "weight_loss", label: "Unexplained weight loss" },
  { id: "tb_contact", label: "Close contact with a TB patient" },
  { id: "past_tb", label: "Previous TB or unfinished TB treatment" },
  { id: "other", label: "Other concern (describe in notes)" },
] as const;

export function tbRedFlagLabel(id: string): string {
  return TB_RED_FLAGS.find((flag) => flag.id === id)?.label ?? id;
}

// suspected: flagged. cleared: flag removed. tb_likely: flagged (older records from the former
// TB Tent, where a doctor recorded that TB was not ruled out).
export type TbStatus = "suspected" | "cleared" | "tb_likely";

export const TB_STATUS_LABELS: Record<TbStatus, string> = {
  suspected: "Suspected TB",
  cleared: "TB flag removed",
  tb_likely: "TB not ruled out",
};

export function isTbFlagged(status: TbStatus | null | undefined): boolean {
  return status === "suspected" || status === "tb_likely";
}
