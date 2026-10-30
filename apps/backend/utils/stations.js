// utils/stations.js
// Default order for newly registered visits. Active visits may have a custom route.
// A visit only queues at the stations it was indicated for.
// Suspected TB is a flag on the visit (utils/tb.js), not a station.

const STATIONS = ['triage', 'seva', 'physiotherapy', 'consultation'];

// Position stored with each visit station in the default order.
const POSITIONS = { triage: 1, seva: 2, physiotherapy: 3, consultation: 4 };

// Returns the valid stations from the input, de-duplicated and in station order,
// or null when the input is not an array or contains an unknown station.
function normalizeStations(input) {
  if (!Array.isArray(input)) return null;
  if (input.some((station) => !STATIONS.includes(station))) return null;
  return STATIONS.filter((station) => input.includes(station));
}

function stationPosition(station) {
  return POSITIONS[station];
}

module.exports = {
  STATIONS,
  normalizeStations,
  stationPosition,
};
