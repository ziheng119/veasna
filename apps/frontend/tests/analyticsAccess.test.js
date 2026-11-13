const React = require('react');
const { act, create } = require('react-test-renderer');
let user = { id: 1, username: 'Admin', token: 'test', role: 'admin' };
const replace = jest.fn(), push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }), usePathname: () => '/' }));
jest.mock('next/link', () => ({ __esModule: true, default: props => React.createElement('a', props) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user, removeUser: jest.fn() }) }));
// The menu's items, as plain entries (its opening animation is not under test here).
jest.mock('../src/components/shared/AccountMenu', () => ({
  __esModule: true,
  default: ({ items }) => require('react').createElement('menu', null,
    items.map(item => require('react').createElement('div', { key: item.label, onClick: item.onSelect, title: item.description }, item.label))),
}));
jest.mock('../src/app/wrappers/AuthWrapper', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/components/analytics/AnalyticsDashboard', () => ({ __esModule: true, default: () => React.createElement('analytics-dashboard') }));
const TopNav = require('../src/components/shared/TopNav').default;
const Page = require('../src/app/analytics/page').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

// Which menu entries each account sees: Analytics with its permission, Station data and Accounts
// for the admin only. The pages themselves are guarded by AuthWrapper (pageAccess.test.js) and the API.
test.each([
  ['admin', { role: 'admin' }, ['Analytics', 'Station data', 'Accounts', 'Logout']],
  ['a user with the defaults', { role: 'user', permissions: ['view_today', 'edit_today'] }, ['Logout']],
  ['a user with analytics', { role: 'user', permissions: ['analytics'] }, ['Analytics', 'Logout']],
])('menu for %s', async (_name, account, entries) => {
  user = { id: 1, username: 'Someone', token: 'test', ...account };
  replace.mockClear(); push.mockClear();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let nav, page;
  try {
    await act(async () => { nav = create(React.createElement(TopNav)); page = create(React.createElement(Page)); });
    const menu = nav.root.findByType('menu').findAllByType('div');
    expect(menu.map(entry => entry.children.join(''))).toEqual(entries);
    // Every entry says what it does.
    expect(menu.every(entry => entry.props.title)).toBe(true);
    if (entries.includes('Analytics')) {
      await act(async () => menu[0].props.onClick());
      expect(push).toHaveBeenCalledWith('/analytics');
    }
    expect(page.root.findAllByType('analytics-dashboard')).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();
  } finally {
    if (nav) await act(async () => nav.unmount());
    if (page) await act(async () => page.unmount());
    log.mockRestore();
  }
});

test('the tabs start with Patient List, then Registration; the Patient List needs its permission', async () => {
  const tabs = async account => {
    user = { id: 1, username: 'Someone', token: 'test', ...account };
    let nav;
    await act(async () => { nav = create(React.createElement(TopNav)); });
    const labels = nav.root.findAllByType('a').map(link => link.props.children);
    await act(async () => nav.unmount());
    return labels;
  };
  expect((await tabs({ role: 'admin' })).slice(0, 3)).toEqual(['Patient List', 'Registration', 'Triage']);
  expect((await tabs({ role: 'user', permissions: [] })).slice(0, 2)).toEqual(['Registration', 'Triage']);
});
