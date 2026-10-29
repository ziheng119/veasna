const CONDITIONS = require('../../../shared/consultationConditions.json');
const ids = new Set(CONDITIONS.map(condition => condition.id));
// Null means not reviewed; [] explicitly records no listed conditions. Missing
// fields from older clients preserve saved labels instead of silently clearing them.
function validConditions(value) {
  return value == null || (Array.isArray(value) && value.length <= CONDITIONS.length &&
    value.every(id => typeof id === 'string' && ids.has(id)) && new Set(value).size === value.length);
}
module.exports = { CONDITIONS, validConditions };
