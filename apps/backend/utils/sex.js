function normalizeSexToEnum(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === 'M') return 'M';
  if (normalized === 'F') return 'F';

  return null;
}

module.exports = {
  normalizeSexToEnum,
};
