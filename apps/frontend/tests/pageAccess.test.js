const React = require('react');
const { act, create } = require('react-test-renderer');
const replace = jest.fn();
const router = { replace };
let pathname = '/doctors-consultation';
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => pathname }));
jest.mock('../src/stores/useUserStore', () => {
  const { create } = require('zustand');
  return { useUserStore: create(set => ({
    user: null, hasHydrated: true, setUser: user => set({ user }), removeUser: () => set({ user: null }),
  })) };
});
const { useUserStore } = require('../src/stores/useUserStore');
const AuthWrapper = require('../src/app/wrappers/AuthWrapper').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test('direct unauthorized URL never renders its page and permissions come from the server', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const originalFetch = global.fetch;
  const token = `x.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64')}.x`;
  useUserStore.setState({ user: { id: 1, username: 'Doctor', role: 'admin', token } });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, username: 'Doctor', role: 'invalid' }) });
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(AuthWrapper, null, React.createElement('protected-page'))); });
    expect(renderer.root.findAllByType('protected-page')).toHaveLength(0);
    expect(replace).toHaveBeenCalledWith('/login');
    expect(useUserStore.getState().user.role).toBe('invalid');
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, username: 'Doctor', role: 'user' }) });
    pathname = '/triage';
    await act(async () => renderer.update(React.createElement(AuthWrapper, null, React.createElement('protected-page'))));
    expect(renderer.root.findAllByType('protected-page')).toHaveLength(1);
    pathname = '/seva';
    global.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await act(async () => renderer.update(React.createElement(AuthWrapper, null, React.createElement('protected-page'))));
    expect(renderer.root.findAllByType('protected-page')).toHaveLength(0);
    expect(useUserStore.getState().user).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    global.fetch = originalFetch; log.mockRestore();
  }
});

test("a device whose clock is days ahead stays signed in, and learns the host's clock", async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const originalFetch = global.fetch;
  const { useHostClockStore } = require('../src/stores/useHostClockStore');
  // Issued by the host an hour ago, valid for 7 days; this device's clock reads 10 days later.
  const hostNow = Date.now();
  const token = `x.${Buffer.from(JSON.stringify({ exp: Math.floor(hostNow / 1000) + 7 * 86400 })).toString('base64')}.x`;
  jest.useFakeTimers({ now: hostNow + 10 * 86400000, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  replace.mockClear(); pathname = '/triage';
  useUserStore.setState({ user: { id: 2, username: 'Nurse', role: 'user', token } });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
    id: 2, username: 'Nurse', role: 'user', screening_date: null, server_time: new Date(hostNow).toISOString(), utc_offset_minutes: 420,
  }) });
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(AuthWrapper, null, React.createElement('protected-page'))); });
    expect(renderer.root.findAllByType('protected-page')).toHaveLength(1);
    expect(replace).not.toHaveBeenCalledWith('/login');
    expect(useUserStore.getState().user.token).toBe(token);
    expect(useHostClockStore.getState()).toMatchObject({ utcOffsetMinutes: 420 });
    expect(Math.round(useHostClockStore.getState().offsetMs / 86400000)).toBe(-10);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    jest.useRealTimers(); useHostClockStore.setState({ offsetMs: 0, utcOffsetMinutes: null });
    global.fetch = originalFetch; log.mockRestore();
  }
});

test('a brief Wi-Fi drop on a page change is retried quietly; a longer one shows Retry', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const originalFetch = global.fetch;
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  pathname = '/triage';
  useUserStore.setState({ user: { id: 2, username: 'Nurse', role: 'user', token: 'x.e30.x' } });
  const profile = { ok: true, status: 200, json: async () => ({ id: 2, username: 'Nurse', role: 'user', screening_date: null }) };
  global.fetch = jest.fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(profile);
  const alerts = () => renderer.root.findAll(node => node.props.role === 'alert');
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(AuthWrapper, null, React.createElement('protected-page'))); });
    expect(alerts()).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(alerts()).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(alerts()).toHaveLength(0);
    expect(renderer.root.findAllByType('protected-page')).toHaveLength(1);

    // The host stays unreachable on the next page: after the retries, the error and its Retry button.
    global.fetch.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
    pathname = '/seva';
    await act(async () => renderer.update(React.createElement(AuthWrapper, null, React.createElement('protected-page'))));
    await act(async () => { jest.advanceTimersByTime(1000); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(alerts()).toHaveLength(1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    jest.useRealTimers(); global.fetch = originalFetch; log.mockRestore();
  }
});

test('a sign-in renewed by the host is stored without remounting the open page', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const originalFetch = global.fetch;
  pathname = '/triage';
  useUserStore.setState({ user: { id: 2, username: 'Nurse', role: 'user', token: 'old.e30.x' } });
  const profile = (token) => ({ ok: true, status: 200, json: async () => ({ id: 2, username: 'Nurse', role: 'user', screening_date: null, token }) });
  // The first check: nothing to renew. The next (a later page check): the host renews the sign-in.
  global.fetch = jest.fn().mockResolvedValueOnce(profile(undefined)).mockResolvedValueOnce(profile('new.e30.x'))
    .mockResolvedValue(profile(undefined));
  const mounts = jest.fn();
  function Form() { React.useEffect(() => { mounts(); }, []); return React.createElement('protected-page'); }
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(AuthWrapper, null, React.createElement(Form))); });
    expect(mounts).toHaveBeenCalledTimes(1);
    pathname = '/triage?visit=1';
    await act(async () => renderer.update(React.createElement(AuthWrapper, null, React.createElement(Form))));
    expect(useUserStore.getState().user.token).toBe('new.e30.x');
    expect(renderer.root.findAllByType('protected-page')).toHaveLength(1);
    // Mounted once: the token change did not swap the form for a spinner and back.
    expect(mounts).toHaveBeenCalledTimes(1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    global.fetch = originalFetch; log.mockRestore();
  }
});
