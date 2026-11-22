import conditions from "../../../../shared/consultationConditions.json";
// Built-in list. Forms and analytics use the editable list (useFormOptions("consultation_conditions")).
export const CONSULTATION_CONDITIONS = conditions;

// Patients reached is brand blue and patients consulted slate (drawn dashed), so the patient lines
// never share a colour with a condition.
export const PRIMARY_SERIES_COLOR = "#32559c";
export const SECONDARY_SERIES_COLOR = "#64748b";

// Fixed categorical order for conditions, with no red (red means TB or danger) and no brand blue.
// Colour follows the condition, never its rank, so charts stay consistent; trend lines also differ
// by dash pattern (CONDITION_DASHES), so they can be told apart without colour. Past eight
// categories, hues are not generated or reused; extras fall back to gray.
const PALETTE = ["#0e7c86", "#c27c0e", "#7353ba", "#3f8f3a", "#c0508a", "#2b8cc4", "#8c6239", "#5f6b7a"];
const DASHES = ["", "6 3", "2 3", "10 3 2 3", "1 2", "12 4", "6 2 2 2", "3 5"];
// The colour of a condition follows its place in the list (Station data page).
export function conditionColor(id: string, list: readonly { id: string }[] = conditions): string {
  const index = list.findIndex(condition => condition.id === id);
  return (index >= 0 && PALETTE[index]) || "#898781";
}
/** The dash pattern of a condition's trend line (SVG stroke-dasharray); "" is solid. */
export function conditionDash(id: string, list: readonly { id: string }[] = conditions): string {
  const index = list.findIndex(condition => condition.id === id);
  return (index >= 0 && DASHES[index]) || "";
}
