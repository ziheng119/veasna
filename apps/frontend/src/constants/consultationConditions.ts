import conditions from "../../../../shared/consultationConditions.json";
// Built-in list. Forms and analytics use the editable list (useFormOptions("consultation_conditions")).
export const CONSULTATION_CONDITIONS = conditions;

// Fixed categorical order (validated for colour-vision deficiency as adjacent pairs).
// Colour follows the condition, never its rank, so charts stay consistent. Past
// eight categories, hues are not generated or reused; extras fall back to gray.
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
// The colour of a condition follows its place in the list (Station data page).
export function conditionColor(id: string, list: readonly { id: string }[] = conditions): string {
  const index = list.findIndex(condition => condition.id === id);
  return (index >= 0 && PALETTE[index]) || "#898781";
}
export const PRIMARY_SERIES_COLOR = PALETTE[0];
export const SECONDARY_SERIES_COLOR = PALETTE[1];
