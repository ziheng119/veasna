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
  expect(planStationRoute([rows[2], rows[1], rows[0]], { stations: ['triage', 'seva', 'consultation', 'dental'] }).wanted)
    .toEqual(['consultation', 'seva', 'dental']);
});
test('Physiotherapy and Pharmacy are added only from Consult; once there they can be moved or removed', () => {
  expect(plan(['seva', 'consultation', 'physiotherapy'])).toMatchObject({ status: 400, error: expect.stringContaining('Refer to physiotherapy station') });
  expect(plan(['pharmacy', 'seva', 'consultation'])).toMatchObject({ status: 400, error: expect.stringContaining('prescribes') });
  expect(planStationRoute(rows, { stations: ['physiotherapy'] }).status).toBe(400);
  const withPhysio = [...rows, { station: 'physiotherapy', completed_at: null }, { station: 'pharmacy', completed_at: '2026-10-20T02:00:00Z' }];
  const expected = withPhysio.map(s => ({ station: s.station, completed: !!s.completed_at }));
  const edit = stations => planStationRoute(withPhysio, { stations, ordered: true, expected_stations: expected });
  expect(edit(['physiotherapy', 'seva', 'consultation']).wanted).toEqual(['physiotherapy', 'seva', 'consultation']);
  expect(edit(['seva', 'consultation']).wanted).toEqual(['seva', 'consultation']);
  // Returning to a finished Pharmacy is allowed: it was on the route already.
  expect(edit(['pharmacy', 'seva', 'consultation', 'physiotherapy']).reopened).toEqual(['pharmacy']);
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

describe('adding one station in clinic order', () => {
  const { insertInClinicOrder } = require('../utils/stationRoute');
  test.each([
    [['dental', 'consultation', 'seva'], 'physiotherapy', ['dental', 'consultation', 'physiotherapy', 'seva']],
    [['triage', 'dental', 'consultation'], 'seva', ['triage', 'dental', 'consultation', 'seva']],
    [['dental', 'consultation'], 'pharmacy', ['dental', 'consultation', 'pharmacy']],
    // Dental comes before Consultation, so it goes ahead of a later Consultation.
    [['triage', 'consultation'], 'dental', ['triage', 'dental', 'consultation']],
    // Never ahead of the station the patient is waiting at, even if it comes later in clinic order.
    [['seva', 'consultation'], 'physiotherapy', ['seva', 'consultation', 'physiotherapy']],
    // A custom order around it is kept.
    [['triage', 'seva', 'consultation'], 'dental', ['triage', 'dental', 'seva', 'consultation']],
    [['consultation', 'pharmacy'], 'physiotherapy', ['consultation', 'physiotherapy', 'pharmacy']],
    [[], 'pharmacy', ['pharmacy']],
    [['consultation', 'dental'], 'dental', ['consultation', 'dental']],
  ])('%j + %s -> %j', (pending, station, expected) => {
    expect(insertInClinicOrder(pending, station)).toEqual(expected);
  });
});
