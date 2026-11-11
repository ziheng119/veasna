// The host clock sent to devices (utils/hostClock.js).
const { hostClock } = require('../utils/hostClock');

test("reports the host's time, calendar date and timezone", () => {
  const now = new Date(2026, 10, 11, 0, 30); // 00:30 on 11 Nov, host local time
  expect(hostClock(now)).toEqual({
    server_time: now.toISOString(),
    server_date: '2026-11-11',
    utc_offset_minutes: -now.getTimezoneOffset(),
  });
});
