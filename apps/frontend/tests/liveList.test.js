jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }));
const React = require('react');
const { act, create } = require('react-test-renderer');
const { useLiveList } = require('../src/hooks/useLiveList');
const { useRealtimeStore } = require('../src/stores/useRealtimeStore');
const toast = require('react-hot-toast').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Live lists', () => {
  let renderer, latest, errorLog;
  function View({ load }) { latest = useLiveList(load); return null; }
  beforeEach(() => {
    useRealtimeStore.setState({ revision: 0 });
    jest.clearAllMocks();
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    errorLog.mockRestore();
  });
  async function mount(load) { await act(async () => { renderer = create(React.createElement(View, { load })); }); }

  test('another user notification refreshes the displayed rows', async () => {
    const load = jest.fn().mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    await mount(load);
    expect(latest.data).toEqual([{ id: 1 }]);
    await act(async () => useRealtimeStore.getState().invalidate());
    expect(latest.data).toEqual([{ id: 1 }, { id: 2 }]);
  });
  test('late responses cannot overwrite newer data, even if transport ignores cancellation', async () => {
    const old = deferred(), fresh = deferred();
    const load = jest.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => fresh.promise);
    await mount(load);
    await act(async () => useRealtimeStore.getState().invalidate());
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => fresh.resolve([{ id: 2 }]));
    await act(async () => old.resolve([{ id: 1 }]));
    expect(latest.data).toEqual([{ id: 2 }]);
  });
  test('a changed filter reports nothing loaded until its own request answers', async () => {
    const renders = [];
    function Recorder({ load }) { const list = useLiveList(load); renders.push({ load, loaded: list.loaded, data: list.data }); return null; }
    const first = jest.fn().mockResolvedValue([{ location: 1 }]);
    await act(async () => { renderer = create(React.createElement(Recorder, { load: first })); });
    expect(renders[renders.length - 1]).toMatchObject({ loaded: true, data: [{ location: 1 }] });
    const pending = deferred();
    const second = jest.fn(() => pending.promise);
    await act(async () => renderer.update(React.createElement(Recorder, { load: second })));
    // Not even the render that switches filters may present the old rows as this filter's answer.
    const switched = renders.filter(r => r.load === second);
    expect(switched.length).toBeGreaterThan(0);
    expect(switched.every(r => !r.loaded && r.data.length === 0)).toBe(true);
    await act(async () => pending.resolve([{ location: 2 }]));
    expect(renders[renders.length - 1]).toMatchObject({ loaded: true, data: [{ location: 2 }] });
  });
  test('location/filter changes cancel old work and do not keep previous rows', async () => {
    const first = jest.fn().mockResolvedValue([{ location: 1 }]);
    await mount(first);
    const pending = deferred();
    const second = jest.fn(() => pending.promise);
    await act(async () => renderer.update(React.createElement(View, { load: second })));
    expect(latest.data).toEqual([]);
    expect(first.mock.calls[0][0].aborted).toBe(true);
    await act(async () => pending.resolve([{ location: 2 }]));
    expect(latest.data).toEqual([{ location: 2 }]);
  });
  test('refresh failure preserves existing rows and reports stale data', async () => {
    const load = jest.fn().mockResolvedValueOnce([{ id: 1 }]).mockRejectedValueOnce(new Error('offline'));
    await mount(load);
    await act(async () => useRealtimeStore.getState().invalidate());
    expect(latest.data).toEqual([{ id: 1 }]);
    expect(toast.error).toHaveBeenCalled();
  });
  test('unmount aborts the request and suppresses cancellation errors', async () => {
    const pending = deferred(); const load = jest.fn(() => pending.promise);
    await mount(load);
    await act(async () => renderer.unmount()); renderer = null;
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => pending.reject(new Error('aborted')));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
