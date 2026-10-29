import conditions from "../../../../shared/consultationConditions.json";
export const CONSULTATION_CONDITIONS = conditions;

// Fixed categorical order (validated for colour-vision deficiency as adjacent pairs).
// Colour follows the condition, never its rank, so charts stay consistent. Past
// eight categories, hues are not generated or reused; extras fall back to gray.
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const CONDITION_COLORS: Record<string, string> = Object.fromEntries(
  conditions.map((condition, i) => [condition.id, PALETTE[i] ?? "#898781"]),
);
export const PRIMARY_SERIES_COLOR = PALETTE[0];
export const SECONDARY_SERIES_COLOR = PALETTE[1];
