// utils/vitals.js
// Validation shared by registration (POST /api/visits) and admin vitals edits
// (PUT /api/visits/:visitId/vitals), so both store vitals under the same rules.

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

function parseInteger(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(num) ? num : null;
}

const VITALS_ERROR = 'Invalid vitals payload. Please provide valid numeric values and below_3rd_percentile.';

// Returns { values } with every measurement parsed and positive, or { error }.
function normalizeVitals(input) {
  const values = {
    height: parseNumber(input?.height),
    weight: parseNumber(input?.weight),
    bmi: parseNumber(input?.bmi),
    bp_systolic: parseInteger(input?.bp_systolic),
    bp_diastolic: parseInteger(input?.bp_diastolic),
    temperature: parseNumber(input?.temperature),
    below_3rd_percentile: typeof input?.below_3rd_percentile === 'boolean' ? input.below_3rd_percentile : null,
    notes: input?.notes ?? null,
  };
  const measurements = ['height', 'weight', 'bmi', 'bp_systolic', 'bp_diastolic', 'temperature'];
  if (measurements.some((field) => values[field] === null || values[field] <= 0) || values.below_3rd_percentile === null) {
    return { error: VITALS_ERROR };
  }
  return { values };
}

module.exports = { normalizeVitals };
