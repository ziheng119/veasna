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

describe('the 6 am location reset (stores/useLocationStore.ts)', () => {
  const { nextHostHour } = require('../src/stores/useHostClockStore');
  test("is the next 6 am on the host's clock and calendar", () => {
    useHostClockStore.setState({ offsetMs: 0, utcOffsetMinutes: 420 }); // Cambodia, UTC+7
    // 05:00 there: 6 am today (23:00 UTC the day before).
    expect(new Date(nextHostHour(6, new Date('2026-11-10T22:00:00Z'))).toISOString()).toBe('2026-11-10T23:00:00.000Z');
    // 07:00 there: 6 am tomorrow.
    expect(new Date(nextHostHour(6, new Date('2026-11-11T00:00:00Z'))).toISOString()).toBe('2026-11-11T23:00:00.000Z');
  });

  test("uses the host's time, not this device's, however far out this device's clock is", () => {
    jest.useFakeTimers({ now: new Date('2026-11-13T00:00:00Z') });
    // The device reads two days ahead; on the host it is 05:00 on 11 November (UTC+7).
    useHostClockStore.setState({ offsetMs: -2 * DAY - 2 * 3600000, utcOffsetMinutes: 420 });
    expect(new Date(nextHostHour(6)).toISOString()).toBe('2026-11-10T23:00:00.000Z');
  });

  test('a location chosen yesterday is forgotten after 6 am on the host, even after the device clock is set right', () => {
    const items = new Map();
    global.localStorage = { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, v), removeItem: k => items.delete(k) };
    // Chosen at 19:00 on the host (UTC+7), on a tablet whose clock was a day fast.
    // A fresh load of the stores, as when the app opens, with this device's view of the host clock.
    const openApp = (offsetMs) => {
      let store;
      jest.isolateModules(() => {
        require('../src/stores/useHostClockStore').useHostClockStore.setState({ offsetMs, utcOffsetMinutes: 420 });
        store = require('../src/stores/useLocationStore').useLocationStore;
      });
      return store;
    };
    jest.useFakeTimers({ now: new Date('2026-11-11T12:00:00Z') });
    openApp(-DAY).getState().setCurrentLocation({ id: 3, name: 'Village' });
    // 06:30 the next morning on the host, and the tablet's clock has been corrected.
    jest.setSystemTime(new Date('2026-11-10T23:30:00Z'));
    expect(openApp(0).getState().currentLocation).toBeNull();
    delete global.localStorage;
  });
});
