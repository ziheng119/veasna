// Which saved referrals to print (GET /api/visits/referrals). A referral counts on its referral date,
// or its visit's date when it has none.
//   location_id: a location id, or "all" for every location
//   date=YYYY-MM-DD for one day, from=...&to=... for a period (both days included), or all=true for
//   every date.
const { toPositiveInt, isIsoDate } = require('./validation');

const ERROR = 'Give location_id (an id or "all") and one of: date, from and to, or all=true (dates as YYYY-MM-DD).';

// Returns { locationId (null for all), from, to (null for no limit) }, or { error }.
function parseReferralFilter(query) {
  const fail = (error = ERROR) => ({ error });
  const locationId = query.location_id === 'all' ? null : toPositiveInt(query.location_id);
  if (query.location_id !== 'all' && !locationId) return fail();

  const { date, from, to, all } = query;
  const given = [date !== undefined, from !== undefined || to !== undefined, all !== undefined].filter(Boolean).length;
  if (given !== 1) return fail();
  if (all !== undefined) return all === 'true' ? { locationId, from: null, to: null } : fail();
  if (date !== undefined) return isIsoDate(date) ? { locationId, from: date, to: date } : fail();
  if (!isIsoDate(from) || !isIsoDate(to)) return fail();
  if (from > to) return fail('The period must start on or before the day it ends.');
  return { locationId, from, to };
}

module.exports = { parseReferralFilter };
