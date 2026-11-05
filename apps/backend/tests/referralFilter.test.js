// Which referrals GET /api/visits/referrals prints (utils/referralFilter.js).
const { parseReferralFilter } = require('../utils/referralFilter');

test('one day, a period, or every date; at one location or all', () => {
  expect(parseReferralFilter({ location_id: '3', date: '2026-11-05' })).toEqual({ locationId: 3, from: '2026-11-05', to: '2026-11-05' });
  expect(parseReferralFilter({ location_id: 'all', from: '2026-10-01', to: '2026-10-31' })).toEqual({ locationId: null, from: '2026-10-01', to: '2026-10-31' });
  expect(parseReferralFilter({ location_id: '3', all: 'true' })).toEqual({ locationId: 3, from: null, to: null });
});

test.each([
  ['no location', { date: '2026-11-05' }],
  ['a bad location', { location_id: 'x', date: '2026-11-05' }],
  ['no dates at all', { location_id: '3' }],
  ['a day and a period together', { location_id: '3', date: '2026-11-05', from: '2026-11-01', to: '2026-11-05' }],
  ['half a period', { location_id: '3', from: '2026-11-01' }],
  ['a day that does not exist', { location_id: '3', date: '2026-02-30' }],
  ['all set to something else', { location_id: '3', all: 'yes' }],
])('refuses %s', (_, query) => {
  expect(parseReferralFilter(query).error).toBeTruthy();
});

test('a period that ends before it starts is refused with its own message', () => {
  expect(parseReferralFilter({ location_id: '3', from: '2026-11-05', to: '2026-11-01' }).error).toMatch(/start on or before/);
});
