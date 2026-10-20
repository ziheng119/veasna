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
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, username: 'Doctor', role: 'triage' }) });
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(AuthWrapper, null, React.createElement('protected-page'))); });
    expect(renderer.root.findAllByType('protected-page')).toHaveLength(0);
    expect(replace).toHaveBeenCalledWith('/triage');
    expect(useUserStore.getState().user.role).toBe('triage');
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
