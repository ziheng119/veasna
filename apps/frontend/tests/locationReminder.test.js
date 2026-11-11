// The "Please set your location!" reminder (hooks/useLocationReminder.ts): one at a time, however
// many pages ask, and none during the guided tour.
const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('react-hot-toast', () => Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }));
const toast = require('react-hot-toast');
const { useLocationReminder, LOCATION_REMINDER_ID } = require('../src/hooks/useLocationReminder');
const { useLocationStore } = require('../src/stores/useLocationStore');
const { useGuideStore } = require('../src/stores/useGuideStore');
global.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { delete global.localStorage; });

function Page() { useLocationReminder(); return null; }
const open = () => { let tree; act(() => { tree = create(React.createElement(Page)); }); return tree; };

beforeEach(() => {
  const stored = new Map();
  global.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) };
  toast.mockClear();
  useLocationStore.setState({ currentLocation: null });
  useGuideStore.setState({ active: false });
});

test('moving between pages with no location keeps to one reminder, not one per page', () => {
  for (let i = 0; i < 5; i++) { const tree = open(); act(() => tree.unmount()); }
  expect(toast).toHaveBeenCalledTimes(5);
  // The same id each time, so the toast is updated in place instead of stacking.
  expect(new Set(toast.mock.calls.map(([, options]) => options.id))).toEqual(new Set([LOCATION_REMINDER_ID]));
});

test('no reminder with a location chosen, or during the guided tour', () => {
  useGuideStore.setState({ active: true });
  const tree = open();
  expect(toast).not.toHaveBeenCalled();
  // The tour ends with no location: now it asks.
  act(() => useGuideStore.setState({ active: false }));
  expect(toast).toHaveBeenCalledTimes(1);
  act(() => useLocationStore.setState({ currentLocation: { id: 1, name: 'Kampong' } }));
  act(() => tree.unmount());
  open();
  expect(toast).toHaveBeenCalledTimes(1);
});
