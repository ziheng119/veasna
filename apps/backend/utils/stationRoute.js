const { STATIONS, normalizeStations } = require('./stations');

// Compare pending order and completion state, ignoring where completed rows are displayed.
function routeSnapshot(stations) {
  return JSON.stringify({
    pending: stations.filter(s => !s.completed).map(s => s.station),
    completed: stations.filter(s => s.completed).map(s => s.station).sort(),
  });
}

function planStationRoute(existing, body) {
  const fail = (status, message) => ({ error: message, status });
  const { stations, ordered, expected_stations: expected } = body;
  if (ordered !== undefined && typeof ordered !== 'boolean') return fail(400, 'ordered must be a boolean');
  if (!Array.isArray(stations) || !stations.length || stations.some(s => !STATIONS.includes(s)) || new Set(stations).size !== stations.length) {
    return fail(400, 'Select distinct valid stations, or discharge the patient to end the visit.');
  }
  const pending = existing.filter(s => !s.completed_at).map(s => s.station);
  const completed = existing.filter(s => s.completed_at).map(s => s.station);
  if (ordered) {
    if (!Array.isArray(expected) || expected.some(s => !s || !STATIONS.includes(s.station) || typeof s.completed !== 'boolean') || new Set(expected.map(s => s.station)).size !== expected.length) {
      return fail(400, 'expected_stations is required for an ordered route');
    }
    const current = existing.map(s => ({ station: s.station, completed: !!s.completed_at }));
    if (routeSnapshot(expected) !== routeSnapshot(current)) return fail(409, 'The route changed on another device. Close and reopen this dialog before saving.');
  }
  // Legacy callers still exclude completed stations. Preserve any custom route and
  // append newly indicated stations rather than restoring the original fixed order.
  const wanted = ordered ? [...stations] : [
    ...pending.filter(s => stations.includes(s)),
    ...normalizeStations(stations).filter(s => !pending.includes(s) && !completed.includes(s)),
  ];
  if (!wanted.length) return fail(400, 'Every selected station is already completed. Discharge the patient to end the visit.');
  return { wanted, previousCurrent: pending[0] || null, reopened: wanted.filter(s => completed.includes(s)) };
}

module.exports = { planStationRoute };
