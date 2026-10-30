const { planStationRoute } = require('../utils/stationRoute');
const rows = [
  { station: 'triage', completed_at: '2026-10-20T01:00:00Z' },
  { station: 'seva', completed_at: null },
  { station: 'consultation', completed_at: null },
];
const snapshot = rows.map(s => ({ station: s.station, completed: !!s.completed_at }));
const plan = stations => planStationRoute(rows, { stations, ordered: true, expected_stations: snapshot });

test('reopens a completed station as the next stop', () => {
  expect(plan(['triage', 'seva', 'consultation'])).toMatchObject({ wanted: ['triage', 'seva', 'consultation'], reopened: ['triage'], previousCurrent: 'seva' });
});
test('defers a pending station without completing it', () => {
  expect(plan(['consultation', 'seva'])).toMatchObject({ wanted: ['consultation', 'seva'], reopened: [] });
});
test('legacy edits preserve pending custom order and never reopen completed stations', () => {
  expect(planStationRoute([rows[2], rows[1], rows[0]], { stations: ['triage', 'seva', 'consultation', 'physiotherapy'] }).wanted)
    .toEqual(['consultation', 'seva', 'physiotherapy']);
});
test.each([[], ['bad'], ['seva', 'seva'], null])('rejects invalid routes %j', stations => {
  expect(plan(stations).status).toBe(400);
});
test('rejects missing snapshots and changed routes', () => {
  expect(planStationRoute(rows, { stations: ['seva'], ordered: true }).status).toBe(400);
  expect(planStationRoute(rows, { stations: ['seva'], ordered: true, expected_stations: [] }).status).toBe(409);
  expect(planStationRoute([...rows].reverse(), { stations: ['seva'], ordered: true, expected_stations: snapshot }).status).toBe(409);
});
test('TB is a flag on the visit, not a station', () => {
  expect(plan(['tb', 'seva']).status).toBe(400);
});
