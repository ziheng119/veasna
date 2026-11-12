// Which referrals GET /api/visits/referrals prints (utils/referralFilter.js).
const { parseReferralFilter } = require('../utils/referralFilter');

test('one day, a period, or every date', () => {
  expect(parseReferralFilter({ date: '2026-11-05' })).toEqual({ from: '2026-11-05', to: '2026-11-05' });
  expect(parseReferralFilter({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  expect(parseReferralFilter({ all: 'true' })).toEqual({ from: null, to: null });
});

test('a location sent by an older client is ignored', () => {
  expect(parseReferralFilter({ location_id: '3', date: '2026-11-05' })).toEqual({ from: '2026-11-05', to: '2026-11-05' });
});

test.each([
  ['no dates at all', {}],
  ['a day and a period together', { date: '2026-11-05', from: '2026-11-01', to: '2026-11-05' }],
  ['half a period', { from: '2026-11-01' }],
  ['a day that does not exist', { date: '2026-02-30' }],
  ['all set to something else', { all: 'yes' }],
])('refuses %s', (_, query) => {
  expect(parseReferralFilter(query).error).toBeTruthy();
});

test('a period that ends before it starts is refused with its own message', () => {
  expect(parseReferralFilter({ from: '2026-11-05', to: '2026-11-01' }).error).toMatch(/start on or before/);
});
