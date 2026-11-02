// Queue card actions for a non-admin user: moving patients is open to everyone, and a suspected
// TB patient's card offers Clear TB.
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }), usePathname: () => '/doctors-consultation', useSearchParams: () => new URLSearchParams() }));
jest.mock('../src/stores/useUserStore', () => {
  const { create } = require('zustand'); return { useUserStore: create(() => ({ user: { id: 2, role: 'user', token: 't' } })) };
});
jest.mock('../src/components/shared/PageCard', () => ({ PageCard: ({ action, headerExtra, children }) => React.createElement('section', null, action, headerExtra, children) }));
jest.mock('../src/components/ui/badge', () => ({ Badge: ({ children }) => React.createElement('span', null, children) }));
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => React.createElement('input', props) }));
const refresh = jest.fn();
let stationPatients = [];
jest.mock('../src/hooks/useLiveList', () => ({ useLiveList: () => ({ data: stationPatients, refresh }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/components/shared/EditStationsDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/lib/api/tb/tb', () => ({ setTbFlag: jest.fn(async () => ({ flagged: false, status: 'cleared', current_station: 'consultation' })) }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const { setTbFlag } = require('../src/lib/api/tb/tb');
const QueuePatientPicker = require('../src/components/shared/QueuePatientPicker').default;
const { PatientQueue } = require('../src/components/home/PatientQueue');
global.IS_REACT_ACT_ENVIRONMENT = true;

const tbPatient = {
  visit_id: 5, queue_no: '7', english_name: 'Dara', timestamp: '08:00 AM', tb_flagged: true, tb_status: 'suspected',
  stations: [{ station: 'consultation', completed: false }, { station: 'triage', completed: false }],
};
const label = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : label(child))).join('');
const button = (renderer, text) => renderer.root.findAllByType('button').find(node => label(node).includes(text));

let renderer;
beforeEach(() => { global.window = Object.assign(new EventTarget(), { confirm: jest.fn(() => true) }); });
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null; delete global.window; jest.clearAllMocks();
});

test('a user can use Next, Send to and Discharge on a station queue card', async () => {
  stationPatients = [{ ...tbPatient, tb_flagged: false }];
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient: jest.fn() })); });
  for (const text of ['Next', 'Send to', 'Discharge']) expect(button(renderer, text).props.disabled).toBeFalsy();
  expect(button(renderer, 'Clear TB')).toBeUndefined();
});

test('a user can clear a TB flag from the station queue card; the selected patient stays selected', async () => {
  stationPatients = [tbPatient];
  const onSelectPatient = jest.fn();
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient, selectedVisitId: 5 })); });
  await act(async () => button(renderer, 'Clear TB').props.onClick());
  expect(window.confirm).toHaveBeenCalled();
  expect(setTbFlag).toHaveBeenCalledWith(5, { flagged: false }, 't');
  expect(onSelectPatient).toHaveBeenCalledWith(expect.objectContaining({ visit_id: 5, tb_flagged: false }));
  expect(refresh).toHaveBeenCalled();
});

test('clearing a TB patient waiting at another station deselects them, since they move to Consult', async () => {
  stationPatients = [{ ...tbPatient, stations: [{ station: 'triage', completed: false }] }];
  const onSelectPatient = jest.fn();
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'triage', onSelectPatient, selectedVisitId: 5 })); });
  await act(async () => button(renderer, 'Clear TB').props.onClick());
  expect(onSelectPatient).toHaveBeenCalledWith(null);
});

test('nothing is cleared when the confirmation is cancelled', async () => {
  window.confirm.mockReturnValue(false);
  stationPatients = [tbPatient];
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient: jest.fn() })); });
  await act(async () => button(renderer, 'Clear TB').props.onClick());
  expect(setTbFlag).not.toHaveBeenCalled();
});

test('the Home queue card lets a user discharge and clear TB', async () => {
  global.localStorage = { getItem: () => null, setItem: () => {} };
  try {
    await act(async () => { renderer = create(React.createElement(PatientQueue, { patients: [tbPatient], onRemovePatient: jest.fn() })); });
    expect(renderer.root.findAllByType('button').find(node => node.props.title === 'Discharge patient').props.disabled).toBeFalsy();
    await act(async () => button(renderer, 'Clear TB').props.onClick());
    expect(setTbFlag).toHaveBeenCalledWith(5, { flagged: false }, 't');
  } finally {
    delete global.localStorage;
  }
});
