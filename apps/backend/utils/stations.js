// utils/stations.js
// Default order for newly registered visits. Active visits may have a custom route.
// A visit only queues at the stations it was indicated for.
// The TB tent comes first: a visit with the TB tent still pending is on TB hold and cannot
// be seen at, or moved to, any other station until a TB doctor clears it (see utils/tb.js).

const STATIONS = ['tb', 'triage', 'seva', 'physiotherapy', 'consultation'];

// Position stored with each visit station. TB is 0 so the existing numbering is unchanged.
const POSITIONS = { tb: 0, triage: 1, seva: 2, physiotherapy: 3, consultation: 4 };

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
