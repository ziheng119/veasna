// TB red flags checked at registration. Ticking any of them flags the patient for suspected TB:
// they are queued at the TB tent first and cannot be seen at any other station until a TB
// doctor clears them. Update this list to match the red flags provided by the doctors.
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

// suspected: waiting for the TB doctor. cleared: no TB, may go to other stations.
// tb_likely: TB not ruled out, stays in the TB tent until discharged.
export type TbStatus = "suspected" | "cleared" | "tb_likely";

export const TB_STATUS_LABELS: Record<TbStatus, string> = {
  suspected: "Suspected TB: waiting for TB doctor",
  cleared: "Cleared by TB doctor: no TB",
  tb_likely: "TB not ruled out: keep isolated",
};
