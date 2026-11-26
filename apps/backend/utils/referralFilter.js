// Which saved referrals to print (GET /api/visits/referrals). A referral counts on its referral date,
// or its visit's date when it has none.
//   date=YYYY-MM-DD for one day, from=...&to=... for a period (both days included), or all=true for
//   every date. Or visit_ids=1,2,3 alone for those visits' referrals on any date (Analytics prints
//   one destination's list this way). A location_id sent by an older client is ignored.
const { isIsoDate } = require('./validation');

const ERROR = 'Give one of: date, from and to, or all=true (dates as YYYY-MM-DD).';

// Returns { from, to (null for no limit) }, or { error }.
function parseReferralFilter(query) {
  const fail = (error = ERROR) => ({ error });
  const { date, from, to, all, visit_ids: visitIds } = query;
  if (visitIds !== undefined) {
    const ids = typeof visitIds === 'string' ? visitIds.split(',').map(Number) : [];
    const valid = ids.length > 0 && ids.length <= 1000 && ids.every(id => Number.isInteger(id) && id > 0);
    if (!valid || date !== undefined || from !== undefined || to !== undefined || all !== undefined) {
      return fail('visit_ids must be a comma-separated list of visit ids, given on its own.');
    }
    return { from: null, to: null, visitIds: ids };
  }
  const given = [date !== undefined, from !== undefined || to !== undefined, all !== undefined].filter(Boolean).length;
  if (given !== 1) return fail();
  if (all !== undefined) return all === 'true' ? { from: null, to: null } : fail();
  if (date !== undefined) return isIsoDate(date) ? { from: date, to: date } : fail();
  if (!isIsoDate(from) || !isIsoDate(to)) return fail();
  if (from > to) return fail('The period must start on or before the day it ends.');
  return { from, to };
}

module.exports = { parseReferralFilter };
