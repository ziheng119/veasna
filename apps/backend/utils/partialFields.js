// Helpers for station forms that may be saved partially filled.

// Missing text is stored as an empty string.
function textOrEmpty(value) {
  return value === null || value === undefined ? '' : String(value);
}

// A blank date is stored as NULL.
function dateOrNull(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

module.exports = { textOrEmpty, dateOrNull };
