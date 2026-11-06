const { getOptions } = require('./formOptions');
// Null means not reviewed; [] explicitly records no listed conditions. Missing
// fields from older clients preserve saved labels instead of silently clearing them.
// Valid ids are those in the Consult form's current list (Station data page).
async function validConditions(value) {
  if (value == null) return true;
  if (!Array.isArray(value)) return false;
  const ids = new Set((await getOptions('consultation_conditions')).map(condition => condition.id));
  return value.length <= ids.size && value.every(id => typeof id === 'string' && ids.has(id)) &&
    new Set(value).size === value.length;
}
module.exports = { validConditions };
