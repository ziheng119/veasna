// Visual acuity is recorded as a Snellen fraction such as "6/6" or "6/9".
export const SNELLEN_OPTIONS = ["6/5", "6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "3/60", "1/60"];

const SNELLEN_PATTERN = /^\d+(\.\d+)?\/\d+(\.\d+)?$/;

// Returns the fraction without spaces, or null when the value is not a fraction.
export function normalizeSnellen(value: string): string | null {
  const compact = (value ?? "").replace(/\s+/g, "");
  return SNELLEN_PATTERN.test(compact) ? compact : null;
}

// Normalizes every field. Blank fields (reading not taken yet) stay blank;
// returns null if any filled field is not a Snellen fraction.
export function normalizeSnellenFields<K extends string>(fields: Record<K, string>): Record<K, string> | null {
  const result = {} as Record<K, string>;
  for (const key of Object.keys(fields) as K[]) {
    const raw = (fields[key] ?? "").trim();
    if (!raw) {
      result[key] = "";
      continue;
    }
    const normalized = normalizeSnellen(raw);
    if (!normalized) return null;
    result[key] = normalized;
  }
  return result;
}

export const SNELLEN_ERROR = "Visual acuity must be a fraction such as 6/6 or 6/9, or left unselected.";
