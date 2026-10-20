const React = require('react');
const { act, create } = require('react-test-renderer');
const { EventEmitter } = require('events');
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('../src/stores/useUserStore', () => {
  const { create } = require('zustand');
  return { useUserStore: create(set => ({ user: { token: 'test-token' }, removeUser: () => set({ user: null }) })) };
});
jest.mock('../src/lib/api/queue/getQueue', () => ({ clearQueueCache: jest.fn() }));
jest.mock('../src/lib/api/patients/getPatientsByLocation', () => ({ clearPatientsByLocationCache: jest.fn() }));
const { io } = require('socket.io-client');
const Connection = require('../src/components/shared/RealtimeConnection').default;
const { useRealtimeStore } = require('../src/stores/useRealtimeStore');
const { useUserStore } = require('../src/stores/useUserStore');
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('Shared realtime connection', () => {
  let renderer, sockets, errorLog;
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    global.document = new EventTarget(); document.visibilityState = 'visible';
    global.window = new EventTarget();
    useUserStore.setState({ user: { token: 'test-token' } });
    useRealtimeStore.setState({ revision: 0, status: 'connecting' });
    sockets = [];
    io.mockImplementation(() => {
      const socket = new EventEmitter();
      socket.disconnect = jest.fn(); socket.connect = jest.fn();
      sockets.push(socket); return socket;
    });
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    renderer = null; jest.useRealTimers(); errorLog.mockRestore();
    delete global.document; delete global.window;
  });
  async function mount() { await act(async () => { renderer = create(React.createElement(Connection)); }); }
  async function flush() { await act(async () => jest.advanceTimersByTime(100)); }

  test('uses one connection across renders, coalesces bursts, and refreshes on reconnect', async () => {
    await mount();
    await act(async () => renderer.update(React.createElement(Connection)));
    expect(io).toHaveBeenCalledTimes(1);
    expect(io.mock.calls[0][1].auth).toEqual({ token: 'test-token' });
    await act(async () => sockets[0].emit('connect')); await flush();
    expect(useRealtimeStore.getState().status).toBe('live');
    expect(useRealtimeStore.getState().revision).toBe(1);
    await act(async () => { sockets[0].emit('lists:changed'); sockets[0].emit('lists:changed'); }); await flush();
    expect(useRealtimeStore.getState().revision).toBe(2);
    await act(async () => sockets[0].emit('disconnect', 'transport close'));
    expect(useRealtimeStore.getState().status).toBe('offline');
    await act(async () => sockets[0].emit('connect')); await flush();
    expect(useRealtimeStore.getState().revision).toBe(3);
  });
  test('token change replaces the connection and logout disconnects it', async () => {
    await mount();
    await act(async () => useUserStore.setState({ user: { token: 'new-token' } }));
    expect(sockets[0].disconnect).toHaveBeenCalledTimes(1);
    expect(sockets[0].listenerCount('lists:changed')).toBe(0);
    expect(io.mock.calls[1][1].auth.token).toBe('new-token');
    await act(async () => useUserStore.getState().removeUser());
    expect(sockets[1].disconnect).toHaveBeenCalledTimes(1);
  });
  test('unmount cancels pending refreshes and removes event handlers', async () => {
    await mount(); await act(async () => sockets[0].emit('lists:changed'));
    await act(async () => renderer.unmount()); renderer = null;
    await flush();
    expect(useRealtimeStore.getState().revision).toBe(0);
    expect(sockets[0].listenerCount('lists:changed')).toBe(0);
  });
  test('expired authentication clears the session', async () => {
    await mount();
    await act(async () => sockets[0].emit('connect_error', new Error('Authentication required')));
    expect(useUserStore.getState().user).toBeNull();
  });
  test('returning to a visible tab refreshes lists', async () => {
    await mount(); await act(async () => document.dispatchEvent(new Event('visibilitychange'))); await flush();
    expect(sockets[0].connect).toHaveBeenCalled();
    expect(useRealtimeStore.getState().revision).toBe(1);
  });
});
