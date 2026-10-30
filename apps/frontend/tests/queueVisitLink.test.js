// Opening a station page with ?visit=<id> (from the queue search) selects that patient.
const React = require('react');
const { act, create } = require('react-test-renderer');
const replace = jest.fn();
let params = new URLSearchParams();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/seva', useSearchParams: () => params }));
const toast = jest.fn();
jest.mock('react-hot-toast', () => Object.assign((...args) => toast(...args), { success: jest.fn(), error: jest.fn() }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role: 'admin' } }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/components/shared/PageCard', () => ({ PageCard: ({ children }) => React.createElement('section', null, children) }));
jest.mock('../src/components/shared/EditStationsDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/shared/QueueSortControl', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/hooks/useQueueSort', () => ({ useQueueSort: () => ({ mode: 'number', setMode: jest.fn() }) }));
let live = { data: [], loaded: false };
jest.mock('../src/hooks/useLiveList', () => ({ useLiveList: () => ({ ...live, refresh: jest.fn() }) }));
const QueuePatientPicker = require('../src/components/shared/QueuePatientPicker').default;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = callback => callback();
global.document = { querySelector: () => null };

describe('Station page opened from the queue search', () => {
  let renderer, log;
  const render = async onSelectPatient => {
    await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'seva', onSelectPatient })); });
  };
  beforeEach(() => { replace.mockClear(); toast.mockClear(); log = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); log.mockRestore(); });

  test('selects the linked visit once the queue has loaded, then clears the link', async () => {
    params = new URLSearchParams('visit=5');
    live = { data: [], loaded: false };
    const onSelectPatient = jest.fn();
    await render(onSelectPatient);
    expect(onSelectPatient).not.toHaveBeenCalled();

    live = { data: [{ visit_id: 5, queue_no: '4', english_name: 'Dara', stations: [] }], loaded: true };
    await act(async () => renderer.update(React.createElement(QueuePatientPicker, { station: 'seva', onSelectPatient })));
    expect(onSelectPatient).toHaveBeenCalledWith(expect.objectContaining({ visit_id: 5 }));
    expect(replace).toHaveBeenCalledWith('/seva', { scroll: false });
  });

  test('says so when the linked patient has already moved on', async () => {
    params = new URLSearchParams('visit=9');
    live = { data: [{ visit_id: 5, queue_no: '4', stations: [] }], loaded: true };
    const onSelectPatient = jest.fn();
    await render(onSelectPatient);
    expect(onSelectPatient).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('That patient is no longer waiting at Partner NGO.');
    expect(replace).toHaveBeenCalled();
  });
});
