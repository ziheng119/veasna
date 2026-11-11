// Devices keep working on weak Wi-Fi: loads are tried again by themselves, a save whose answer was
// lost isn't refused as someone else's, and the status bar says what still works.
// (lib/api/request.ts, hooks/useLiveList.ts, hooks/useRecordLoad.ts, lib/api/recordVersions.ts,
// stores/useRealtimeStore.ts.)
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn(), dismiss: jest.fn() } }));
const React = require('react');
const { act, create } = require('react-test-renderer');
const { apiFetch, LOAD_RETRY_DELAY_MS } = require('../src/lib/api/request');
const { useLiveList, LIST_RETRY_DELAYS_MS } = require('../src/hooks/useLiveList');
const { useRecordLoad, LOAD_RETRY_DELAYS_MS } = require('../src/hooks/useRecordLoad');
const { expectedVersion, noteVersion, saveError } = require('../src/lib/api/recordVersions');
const { useRealtimeStore } = require('../src/stores/useRealtimeStore');
const toast = require('react-hot-toast').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

const dropped = () => new TypeError('Failed to fetch');
const ok = (body = []) => new Response(JSON.stringify(body), { status: 200 });
let originalFetch, log;
beforeEach(() => {
  originalFetch = global.fetch;
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  log = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.clearAllMocks();
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); log.mockRestore(); });
const wait = (ms) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

describe('a load whose connection drops', () => {
  test('is sent once more and answers', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(dropped()).mockResolvedValueOnce(ok(['row']));
    const answer = apiFetch('http://host/api/queue');
    await jest.advanceTimersByTimeAsync(LOAD_RETRY_DELAY_MS);
    expect(await (await answer).json()).toEqual(['row']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('a save is never sent again by itself, nor a caller that retries on its own', async () => {
    global.fetch = jest.fn().mockRejectedValue(dropped());
    await expect(apiFetch('http://host/api/visits/dental/1', { method: 'POST' })).rejects.toThrow('may not have been saved');
    await expect(apiFetch('http://host/api/auth/me', { retryOnDrop: false })).rejects.toThrow("Couldn't reach the host laptop");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

test('a list whose reload failed tries again by itself, and shows fresh rows once the host answers', async () => {
  const load = jest.fn().mockRejectedValueOnce(dropped()).mockRejectedValueOnce(dropped()).mockResolvedValue(['fresh']);
  let latest;
  function List() { latest = useLiveList(load); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(List)); });
  expect(latest.data).toEqual([]);
  await wait(LIST_RETRY_DELAYS_MS[0]);
  expect(load).toHaveBeenCalledTimes(2);
  await wait(LIST_RETRY_DELAYS_MS[1]);
  expect(load).toHaveBeenCalledTimes(3);
  expect(latest.data).toEqual(['fresh']);
  // Answered: no more retries.
  await wait(LIST_RETRY_DELAYS_MS[2] * 2);
  expect(load).toHaveBeenCalledTimes(3);
  await act(async () => renderer.unmount());
});

test("a station form whose record didn't load keeps trying, with one message, until it loads", async () => {
  const load = jest.fn().mockRejectedValueOnce(dropped()).mockRejectedValueOnce(dropped()).mockResolvedValue({ notes: 'Saved' });
  const show = jest.fn();
  let failing;
  function Form() { failing = useRecordLoad(load, show, "Couldn't load the dental notes"); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Form)); });
  expect(failing).toBe(true);
  expect(toast.error).toHaveBeenCalledWith("Couldn't load the dental notes. Trying again…", { id: 'record-load' });
  await wait(LOAD_RETRY_DELAYS_MS[0]);
  await wait(LOAD_RETRY_DELAYS_MS[1]);
  expect(show).toHaveBeenCalledWith({ notes: 'Saved' });
  expect(failing).toBe(false);
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(toast.dismiss).toHaveBeenCalledWith('record-load');
  await act(async () => renderer.unmount());
});

test("a save whose answer was lost is sent again without a version check, so it isn't refused as someone else's", async () => {
  noteVersion('dental', 41, '2026-11-11T02:00:00.000Z');
  expect(expectedVersion('dental', 41)).toEqual({ expected_updated_at: '2026-11-11T02:00:00.000Z' });
  // No answer (the host may have saved it): the next attempt has no check.
  expect(expectedVersion('dental', 41)).toEqual({});
  // Answered: checked again from the saved version.
  noteVersion('dental', 41, '2026-11-11T02:05:00.000Z');
  expect(expectedVersion('dental', 41)).toEqual({ expected_updated_at: '2026-11-11T02:05:00.000Z' });
  // Refused by the host (so not saved): the next attempt is still checked.
  await saveError(new Response('{"error":"Server error"}', { status: 500 }), 'dental', 41, 'Failed');
  expect(expectedVersion('dental', 41)).toEqual({ expected_updated_at: '2026-11-11T02:05:00.000Z' });
});

test('the status bar knows since when the host has been out of reach', () => {
  jest.setSystemTime(new Date('2026-11-11T03:00:00Z'));
  const { setStatus } = useRealtimeStore.getState();
  setStatus('live');
  setStatus('offline');
  const since = useRealtimeStore.getState().offlineSince;
  expect(since).toBe(new Date('2026-11-11T03:00:00Z').getTime());
  // Reconnect attempts don't reset it; being live again clears it.
  jest.setSystemTime(new Date('2026-11-11T03:05:00Z'));
  setStatus('connecting');
  setStatus('offline');
  expect(useRealtimeStore.getState().offlineSince).toBe(since);
  setStatus('live');
  expect(useRealtimeStore.getState().offlineSince).toBeNull();
});
