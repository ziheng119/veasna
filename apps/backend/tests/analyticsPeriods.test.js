const { tripStart, periodTrend, groupPartnerNgoReferrals } = require('../routes/analytics');

test('a trip walks back through clinic dates at most three days apart', () => {
  const dates = ['2026-11-18', '2026-11-17', '2026-11-14', '2026-11-13', '2026-11-05'];
  expect(tripStart(dates, '2026-11-18')).toBe('2026-11-13');
  // The selected date need not be a clinic date itself.
  expect(tripStart(['2026-11-16', '2026-11-15'], '2026-11-18')).toBe('2026-11-15');
  // Too long since the last clinic date: the trip is the selected date alone.
  expect(tripStart(['2026-11-01'], '2026-11-18')).toBe('2026-11-18');
  expect(tripStart([], '2026-11-18')).toBe('2026-11-18');
});

test('trend buckets follow the period', () => {
  expect(periodTrend('day', '2026-11-18', '2026-11-18').buckets).toHaveLength(7);
  expect(periodTrend('week', '2026-11-18', '2026-11-12').buckets).toHaveLength(7);
  expect(periodTrend('month', '2026-11-18', '2026-10-20').buckets).toHaveLength(30);
  expect(periodTrend('all', '2026-11-18', null)).toMatchObject({ unit: 'month' });
  const trip = periodTrend('trip', '2026-11-18', '2026-11-03');
  expect(trip.unit).toBe('day');
  expect(trip.buckets[0]).toEqual(['2026-11-03', '2026-11-03']);
  expect(trip.buckets).toHaveLength(16);
  const long = periodTrend('trip', '2026-11-18', '2026-09-01');
  expect(long.unit).toBe('week');
  expect(long.buckets.at(-1)).toEqual(['2026-11-12', '2026-11-18']);
  expect(long.buckets[0][0] <= '2026-09-01').toBe(true);
});

test('Partner NGO referral types follow the list, with removed types after', () => {
  const options = [{ id: 'cataract_surgery', label: 'Cataract surgery' }, { id: 'glasses', label: 'Glasses' }];
  const rows = [{ referral: 'glasses', visitId: 2 }, { referral: 'gone', visitId: 3 }, { referral: 'glasses', visitId: 1 }];
  expect(groupPartnerNgoReferrals(rows, options).map(t => [t.id, t.label, t.listed, t.patients.map(p => p.visitId)])).toEqual([
    ['cataract_surgery', 'Cataract surgery', true, []],
    ['glasses', 'Glasses', true, [2, 1]],
    ['gone', 'gone', false, [3]],
  ]);
});
