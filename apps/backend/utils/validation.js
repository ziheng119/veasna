// utils/validation.js
// Input checks shared by routes, so malformed input is answered with 400 instead of
// reaching PostgreSQL and failing as a 500.

const MAX_INT = 2147483647; // PostgreSQL INT / SERIAL upper bound
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Positive INT-range integer from a number or a digits-only string; otherwise null.
function toPositiveInt(value) {
  const number = typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isInteger(number) && number > 0 && number <= MAX_INT ? number : null;
}

// Non-negative INT-range integer (stock counts, quantities); otherwise null.
function toCount(value) {
  if (value === 0 || value === '0') return 0;
  return toPositiveInt(value);
}

// YYYY-MM-DD naming a real calendar day (rejects 2026-02-30).
function isIsoDate(value) {
  return typeof value === 'string' && DATE_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

// Rejects non-integer route IDs (e.g. /patients/abc) with 400 before any handler runs.
function integerParams(router, names) {
  for (const name of names) {
    router.param(name, (req, res, next, value) => {
      if (toPositiveInt(value) === null) return res.status(400).json({ error: `${name} must be a positive integer` });
      next();
    });
  }
}

module.exports = { MAX_INT, toPositiveInt, toCount, isIsoDate, integerParams };
