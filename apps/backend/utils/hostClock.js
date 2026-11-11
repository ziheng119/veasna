// The host laptop's clock, sent to devices so every device files records under the host's date
// (a tablet's own clock is often wrong when it has been offline for a while).
const { localDate } = require('./validation');

function hostClock(now = new Date()) {
  return {
    server_time: now.toISOString(),
    // The host's calendar date: the date new visits are queued under.
    server_date: localDate(now),
    // The host's timezone, in minutes east of UTC (Cambodia: 420).
    utc_offset_minutes: -now.getTimezoneOffset(),
  };
}

module.exports = { hostClock };
