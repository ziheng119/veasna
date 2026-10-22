const React = require('react');
const { act, create } = require('react-test-renderer');
let user = { id: 1, username: 'Admin', token: 'test', role: 'admin' };
const replace = jest.fn(), push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }), usePathname: () => '/' }));
jest.mock('next/link', () => ({ __esModule: true, default: props => React.createElement('a', props) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user, removeUser: jest.fn() }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ setLocations: jest.fn() }) }));
jest.mock('../src/stores/useLocationDataStore', () => ({ useLocationDataStore: selector => selector({ fetchData: jest.fn() }) }));
jest.mock('../src/lib/api/location', () => ({ getLocations: jest.fn().mockResolvedValue([]) }));
jest.mock('../src/components/shared/LocationDropdown', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/ui/dropdown-menu', () => {
  const wrap = ({ children, ...props }) => React.createElement('div', props, children);
  return { DropdownMenu: wrap, DropdownMenuContent: wrap, DropdownMenuItem: wrap, DropdownMenuTrigger: wrap };
});
jest.mock('../src/app/wrappers/AuthWrapper', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/components/analytics/AnalyticsDashboard', () => ({ __esModule: true, default: () => React.createElement('analytics-dashboard') }));
const TopNav = require('../src/components/shared/TopNav').default;
const Page = require('../src/app/analytics/page').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test.each(['admin', 'user'])('menu and direct page access for %s', async role => {
  user = { ...user, role };
  replace.mockClear(); push.mockClear();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let nav, page;
  try {
    await act(async () => { nav = create(React.createElement(TopNav)); page = create(React.createElement(Page)); });
    expect(JSON.stringify(nav.toJSON())).not.toContain('Add User');
    const entry = nav.root.findAll(n => n.type === 'div' && n.children.join('') === 'Analytics');
    expect(entry).toHaveLength(1);
    expect(page.root.findAllByType('analytics-dashboard')).toHaveLength(1);
    if (role === 'admin') {
      await act(async () => entry[0].props.onClick());
      expect(push).toHaveBeenCalledWith('/analytics');
    }
    expect(replace).not.toHaveBeenCalled();
  } finally {
    if (nav) await act(async () => nav.unmount());
    if (page) await act(async () => page.unmount());
    log.mockRestore();
  }
});
