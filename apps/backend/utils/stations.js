// utils/stations.js
// Stations a visit can be routed through, in the order patients move through them.
// A visit only queues at the stations it was indicated for.

const STATIONS = ['triage', 'seva', 'physiotherapy', 'consultation'];

// Returns the valid stations from the input, de-duplicated and in station order,
// or null when the input is not an array or contains an unknown station.
function normalizeStations(input) {
  if (!Array.isArray(input)) return null;
  if (input.some((station) => !STATIONS.includes(station))) return null;
  return STATIONS.filter((station) => input.includes(station));
}

function stationPosition(station) {
  return STATIONS.indexOf(station) + 1;
}

module.exports = {
  STATIONS,
  normalizeStations,
  stationPosition,
};
