const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useUserStore', () => {
  const { create } = require('zustand');
  return { useUserStore: create(() => ({ user: { id: 1 } })) };
});
const { useUserStore } = require('../src/stores/useUserStore');
const { useQueueSort } = require('../src/hooks/useQueueSort');
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('Per-user queue sort preferences', () => {
  let renderer, current, store, log;
  function View({ queue }) { current = useQueueSort(queue); return null; }
  async function mount(queue) { await act(async () => { renderer = create(React.createElement(View, { queue })); }); }
  beforeEach(() => {
    store = new Map();
    global.localStorage = { getItem: jest.fn(k => store.get(k) ?? null), setItem: jest.fn((k, v) => store.set(k, v)) };
    global.window = new EventTarget();
    useUserStore.setState({ user: { id: 1 } });
    log = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; delete global.localStorage; delete global.window; log.mockRestore(); });
  test('Home and station defaults differ; preference survives remount', async () => {
    await mount('home'); expect(current.mode).toBe('number');
    await act(async () => current.setMode('arrival'));
    await act(async () => renderer.unmount()); await mount('home'); expect(current.mode).toBe('arrival');
    await act(async () => renderer.update(React.createElement(View, { queue: 'triage' })));
    expect(current.mode).toBe('arrival');
  });
  test('different users and stations do not inherit another preference', async () => {
    await mount('triage'); await act(async () => current.setMode('number'));
    await act(async () => renderer.update(React.createElement(View, { queue: 'seva' })));
    expect(current.mode).toBe('arrival');
    await act(async () => renderer.update(React.createElement(View, { queue: 'triage' })));
    expect(current.mode).toBe('number');
    await act(async () => useUserStore.setState({ user: { id: 2 } })); expect(current.mode).toBe('arrival');
    await act(async () => useUserStore.setState({ user: { id: 1 } })); expect(current.mode).toBe('number');
  });
  test('blocked storage does not prevent changing the in-memory mode', async () => {
    localStorage.getItem.mockImplementation(() => { throw Error('blocked'); });
    localStorage.setItem.mockImplementation(() => { throw Error('blocked'); });
    await mount('triage'); await act(async () => current.setMode('number')); expect(current.mode).toBe('number');
  });
  test('invalid stored values fall back safely, and storage events update other tabs', async () => {
    await mount('triage'); const key = localStorage.getItem.mock.calls[0][0];
    store.set(key, 'bad');
    const event = new Event('storage'); Object.defineProperty(event, 'key', { value: key });
    await act(async () => window.dispatchEvent(event)); expect(current.mode).toBe('arrival');
    store.set(key, 'number'); await act(async () => window.dispatchEvent(event)); expect(current.mode).toBe('number');
  });
});
