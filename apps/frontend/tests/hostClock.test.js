// Using the host laptop's clock instead of this device's (stores/useHostClockStore.ts,
// components/shared/ClockWarning.tsx, helper/calculate_age.ts).
const React = require('react');
const { act, create } = require('react-test-renderer');
const { useHostClockStore, hostNow, hostToday, isoDate, CLOCK_WARNING_MS } = require('../src/stores/useHostClockStore');
const ClockWarning = require('../src/components/shared/ClockWarning').default;
const { clockDifferenceText } = require('../src/components/shared/ClockWarning');
const { calculateAge } = require('../src/helper/calculate_age');
global.IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 86400000;
const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
afterEach(() => { jest.useRealTimers(); useHostClockStore.setState({ offsetMs: 0, utcOffsetMinutes: null }); });

test("syncing measures the host's clock against the middle of the request", () => {
  const { sync } = useHostClockStore.getState();
  // Sent at 1000 and answered at 1200: the host read its clock (5000) at about 1100.
  sync({ server_time: new Date(5000).toISOString(), utc_offset_minutes: 420 }, 1000, 1200);
  expect(useHostClockStore.getState()).toMatchObject({ offsetMs: 3900, utcOffsetMinutes: 420 });
  // A reply without a clock (an older backend) changes nothing.
  sync({}, 1000, 1200);
  expect(useHostClockStore.getState().offsetMs).toBe(3900);
});

test("today is the host's calendar date, whatever this device's clock or timezone says", () => {
  jest.useFakeTimers({ now: new Date('2026-11-10T18:30:00Z') });
  // Not yet synced: this device's own clock.
  expect(hostToday()).toBe(isoDate(new Date()));
  // The host is in Cambodia (UTC+7), where 18:30 UTC is already 01:30 the next morning.
  useHostClockStore.setState({ offsetMs: 0, utcOffsetMinutes: 420 });
  expect(hostToday()).toBe('2026-11-11');
  // A tablet whose clock is a week behind still files today's referrals under the host's date.
  useHostClockStore.setState({ offsetMs: 7 * DAY, utcOffsetMinutes: 420 });
  expect(hostToday()).toBe('2026-11-18');
  expect(hostNow().toISOString()).toBe('2026-11-17T18:30:00.000Z');
});

test("ages count from the host's date", () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 11, 12) });
  expect(calculateAge('2000-11-12')).toBe(25);
  // The host is two days ahead: the birthday has passed there.
  useHostClockStore.setState({ offsetMs: 2 * DAY });
  expect(calculateAge('2000-11-12')).toBe(26);
});

test('a device clock well off the host shows a warning; a small difference does not', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let renderer;
  await act(async () => { renderer = create(React.createElement(ClockWarning)); });
  expect(renderer.toJSON()).toBeNull();
  await act(async () => useHostClockStore.setState({ offsetMs: CLOCK_WARNING_MS - 1000 }));
  expect(renderer.toJSON()).toBeNull();
  await act(async () => useHostClockStore.setState({ offsetMs: -3 * DAY }));
  expect(text(renderer.toJSON())).toMatch(/clock is 3 days ahead of the host laptop/);
  await act(async () => useHostClockStore.setState({ offsetMs: 10 * 60000 }));
  expect(text(renderer.toJSON())).toMatch(/clock is 10 minutes behind the host laptop/);
  await act(async () => renderer.unmount());
  log.mockRestore();
});

test('clock differences read naturally', () => {
  expect(clockDifferenceText(60000)).toBe('1 minute');
  expect(clockDifferenceText(-90 * 60000)).toBe('90 minutes');
  expect(clockDifferenceText(5 * 3600000)).toBe('5 hours');
  expect(clockDifferenceText(-DAY)).toBe('24 hours');
  expect(clockDifferenceText(400 * DAY)).toBe('400 days');
});
