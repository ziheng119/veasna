const { STATIONS, DOCTOR_ADDED_STATIONS, normalizeStations } = require('./stations');

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
  // Physiotherapy and Pharmacy join a route only from the Consult page (utils/stations.js).
  const added = wanted.filter(s => DOCTOR_ADDED_STATIONS.includes(s) && !existing.some(row => row.station === s));
  if (added.includes('physiotherapy')) return fail(400, 'Physiotherapy is added by the doctor at Consult, with "Refer to physiotherapy station".');
  if (added.includes('pharmacy')) return fail(400, 'Pharmacy is added when the doctor prescribes at Consult.');
  return { wanted, previousCurrent: pending[0] || null, reopened: wanted.filter(s => completed.includes(s)) };
}

// Where a newly needed station goes in the remaining route: before the first later pending station
// that comes after it in clinic order (STATIONS), so a custom order around it is kept. Never before
// pending[0], the station the patient is waiting at. Pharmacy, last in clinic order, goes at the end.
function insertInClinicOrder(pending, station) {
  if (pending.includes(station)) return [...pending];
  const rank = STATIONS.indexOf(station);
  const index = pending.findIndex((other, i) => i > 0 && STATIONS.indexOf(other) > rank);
  return index === -1 ? [...pending, station] : [...pending.slice(0, index), station, ...pending.slice(index)];
}

// Adds or removes one station from an open visit's remaining route, e.g. the partner NGO at Triage,
// Physiotherapy at Consultation, or Pharmacy when the doctor prescribes. The caller must hold the
// visit's row lock. Returns { stations } (the remaining route), or { error, status }:
//   409 when the visit is finished, a needed station is already finished, or the station to remove
//   is the one the patient is waiting at (use Next, Finish or Send to for those).
// With `reopen`, a needed station that is already finished is put back on the route instead (as
// Pharmacy is when more is prescribed after the patient has been there).
// Each change is recorded in visit_station_route_history, like any route edit.
async function setStationNeeded(client, visitId, station, needed, userId, { reopen = false } = {}) {
  const fail = (status, error) => ({ status, error });
  const visit = await client.query('SELECT completed_at FROM visits WHERE id = $1', [visitId]);
  if (!visit.rows.length) return fail(404, 'Visit not found');
  if (visit.rows[0].completed_at) return fail(409, 'This visit is already finished.');
  const { rows: route } = await client.query('SELECT * FROM visit_stations WHERE visit_id = $1 ORDER BY position, id', [visitId]);
  const pending = route.filter((row) => !row.completed_at).map((row) => row.station);
  const done = route.some((row) => row.station === station && row.completed_at);

  if (needed && done && !reopen) return fail(409, 'This station is already finished. Use Send to to send the patient back.');
  if (!needed && pending[0] === station) return fail(409, 'The patient is waiting at this station now. Use Next, Finish or Send to instead.');
  const wanted = needed ? insertInClinicOrder(pending, station) : pending.filter((other) => other !== station);
  if (wanted.join() === pending.join()) return { stations: pending };

  await client.query(
    'INSERT INTO visit_station_route_history (visit_id, previous_stations, requested_stations, last_updated_by) VALUES ($1, $2::jsonb, $3::jsonb, $4)',
    [visitId, JSON.stringify(route), JSON.stringify(wanted), userId]
  );
  if (!needed) {
    await client.query('DELETE FROM visit_stations WHERE visit_id = $1 AND station = $2 AND completed_at IS NULL', [visitId, station]);
  }
  // Positions are rewritten in route order. A visit with nothing pending (all stations finished but
  // not yet discharged) starts its new station straight away. A reopened station starts afresh.
  for (const [index, name] of wanted.entries()) {
    await client.query(
      `INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
       VALUES ($1, $2, $3, CASE WHEN $4 THEN NOW() END, $5)
       ON CONFLICT (visit_id, station) DO UPDATE SET
          position = EXCLUDED.position, last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW(),
          entered_at = CASE WHEN visit_stations.completed_at IS NULL THEN visit_stations.entered_at ELSE EXCLUDED.entered_at END,
          family_ready_at = CASE WHEN visit_stations.completed_at IS NULL THEN visit_stations.family_ready_at END,
          completed_at = NULL`,
      [visitId, name, index + 1, index === 0 && pending.length === 0, userId]
    );
  }
  return { stations: wanted };
}

module.exports = { planStationRoute, insertInClinicOrder, setStationNeeded };
