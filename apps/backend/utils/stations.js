// utils/stations.js
// Stations in clinic order. Active visits may have a custom route, stored as
// visit_stations.position 1, 2, 3... A visit only queues at the stations it was indicated for.
// Must match apps/frontend/src/constants/stations.ts.
// Suspected TB is a flag on the visit (utils/tb.js), not a station.

// Dental comes before Consultation so the doctor sees anything dental found and can refer on.
const STATIONS = ['triage', 'dental', 'consultation', 'physiotherapy', 'seva', 'pharmacy'];

// Stations that can be ticked at registration. Physiotherapy is chosen by the doctor at
// Consultation, and Pharmacy is added when the doctor prescribes (see utils/stationRoute.js).
const REGISTRATION_STATIONS = ['triage', 'dental', 'consultation', 'seva'];
// Stations only the Consult page adds: Physiotherapy when the doctor ticks "Refer to physiotherapy
// station" (it has limited places), and Pharmacy when the doctor prescribes. "Send to" can reorder,
// remove or revisit them, but never add them to a route that doesn't have them.
const DOCTOR_ADDED_STATIONS = ['physiotherapy', 'pharmacy'];
// Used when registration does not say. The partner NGO is added at Triage for suspected cataracts.
const DEFAULT_REGISTRATION_STATIONS = ['triage', 'dental', 'consultation'];

// Returns the valid stations from the input, de-duplicated and in station order,
// or null when the input is not an array or contains an unknown station.
function normalizeStations(input, allowed = STATIONS) {
  if (!Array.isArray(input)) return null;
  if (input.some((station) => !allowed.includes(station))) return null;
  return allowed.filter((station) => input.includes(station));
}

module.exports = {
  STATIONS,
  REGISTRATION_STATIONS,
  DEFAULT_REGISTRATION_STATIONS,
  DOCTOR_ADDED_STATIONS,
  normalizeStations,
};
