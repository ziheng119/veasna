// Visual acuity is stored as a Snellen fraction such as "6/6" or "6/9".
const SNELLEN_PATTERN = /^\d+(\.\d+)?\/\d+(\.\d+)?$/;

function isBlank(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

// Returns the fraction without spaces, or null when the value is not a fraction.
function normalizeSnellen(value) {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/\s+/g, '');
  return SNELLEN_PATTERN.test(compact) ? compact : null;
}

// Normalizes each named field of `source`. A blank field (reading not taken yet)
// becomes null. Returns { values } or { error }.
function normalizeSnellenFields(source, fields) {
  const values = {};
  for (const field of fields) {
    if (isBlank(source[field])) {
      values[field] = null;
      continue;
    }
    const normalized = normalizeSnellen(source[field]);
    if (!normalized) {
      return { error: `${field} must be a Snellen fraction such as 6/6 or 6/9, or left blank` };
    }
    values[field] = normalized;
  }
  return { values };
}

module.exports = { normalizeSnellen, normalizeSnellenFields };
