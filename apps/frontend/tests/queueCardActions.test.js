// Queue cards for a non-admin user: moving patients is open to everyone, a suspected TB patient's
// card stays red when selected and offers Clear TB only at Consult (with an in-app confirmation),
// and Home cards open the patient's station.
const React = require('react');
const { act, create } = require('react-test-renderer');
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push }), usePathname: () => '/doctors-consultation', useSearchParams: () => new URLSearchParams() }));
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
// The dialog renders in place (no portal) so the confirmation can be clicked.
jest.mock('../src/components/ui/dialog', () => {
  const { createElement } = require('react');
  const part = name => ({ children }) => createElement('div', { 'data-dialog': name }, children);
  return {
    Dialog: ({ open, children }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    DialogContent: part('content'), DialogHeader: part('header'), DialogFooter: part('footer'),
    DialogTitle: part('title'), DialogDescription: part('description'),
  };
});
const { setTbFlag } = require('../src/lib/api/tb/tb');
const QueuePatientPicker = require('../src/components/shared/QueuePatientPicker').default;
const { PatientQueue } = require('../src/components/home/PatientQueue');
global.IS_REACT_ACT_ENVIRONMENT = true;

const tbPatient = {
  visit_id: 5, queue_no: '7', english_name: 'Dara', timestamp: '08:00 AM', tb_flagged: true, tb_status: 'suspected',
  stations: [{ station: 'consultation', completed: false }, { station: 'triage', completed: false }],
};
const label = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : label(child))).join('');
// Finds a button by its text in a renderer or in part of the tree (e.g. the dialog).
const button = (within, text) => (within.root ?? within).findAllByType('button').find(node => label(node).includes(text));

let renderer;
const dialog = () => renderer.root.findAll(node => node.props.role === 'dialog')[0];
beforeEach(() => { global.window = Object.assign(new EventTarget(), { confirm: jest.fn(() => true) }); });
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null; delete global.window; jest.clearAllMocks();
});

test('a user can use Next, Send to and Discharge on a station queue card', async () => {
  stationPatients = [{ ...tbPatient, tb_flagged: false, tb_status: null }];
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient: jest.fn() })); });
  for (const text of ['Next', 'Send to', 'Discharge']) expect(button(renderer, text).props.disabled).toBeFalsy();
  expect(button(renderer, 'Clear TB')).toBeUndefined();
});

test.each(['suspected', 'cleared'])('a TB patient (%s) can be finished or discharged, but not sent to other stations', async status => {
  stationPatients = [{ ...tbPatient, tb_status: status, tb_flagged: status === 'suspected', stations: [{ station: 'consultation', completed: false }] }];
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient: jest.fn() })); });
  expect(button(renderer, 'Send to').props.disabled).toBe(true);
  for (const text of ['Finish', 'Discharge']) expect(button(renderer, text).props.disabled).toBeFalsy();
});

test('a selected TB card is highlighted in red only, not with the blue selection', async () => {
  stationPatients = [tbPatient, { ...tbPatient, visit_id: 6, queue_no: '8', tb_flagged: false, tb_status: null }];
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient: jest.fn(), selectedVisitId: 5 })); });
  const card = id => renderer.root.find(node => node.type === 'div' && node.props['data-visit-id'] === id).props.className;
  expect(card(5)).toMatch(/ring-red-500/);
  expect(card(5)).not.toMatch(/primary/);
  // Unselected TB cards still change on hover, like other cards.
  await act(async () => renderer.update(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient: jest.fn(), selectedVisitId: 6 })));
  expect(card(5)).toMatch(/hover:bg-red-100/);
  expect(card(5)).not.toMatch(/ring/);
  expect(card(6)).toMatch(/border-primary bg-primary\/10/);
});

test('a user can clear a TB flag at Consult after confirming in the pop-up; the patient stays selected', async () => {
  stationPatients = [tbPatient];
  const onSelectPatient = jest.fn();
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient, selectedVisitId: 5 })); });
  expect(dialog()).toBeUndefined();
  await act(async () => button(renderer, 'Clear TB').props.onClick());
  expect(label(dialog())).toMatch(/Clear the TB flag for Dara\?.*number 7/);
  expect(setTbFlag).not.toHaveBeenCalled();
  await act(async () => button(dialog(), 'Clear TB flag').props.onClick());
  expect(window.confirm).not.toHaveBeenCalled();
  expect(setTbFlag).toHaveBeenCalledWith(5, { flagged: false }, 't');
  expect(dialog()).toBeUndefined();
  expect(onSelectPatient).toHaveBeenCalledWith(expect.objectContaining({ visit_id: 5, tb_flagged: false }));
  expect(refresh).toHaveBeenCalled();
});

test('nothing is cleared when the pop-up is cancelled', async () => {
  stationPatients = [tbPatient];
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient: jest.fn() })); });
  await act(async () => button(renderer, 'Clear TB').props.onClick());
  await act(async () => button(dialog(), 'Cancel').props.onClick());
  expect(dialog()).toBeUndefined();
  expect(setTbFlag).not.toHaveBeenCalled();
});

test.each(['triage', 'seva', 'physiotherapy'])('there is no Clear TB button in the %s queue', async station => {
  stationPatients = [{ ...tbPatient, stations: [{ station, completed: false }] }];
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station, onSelectPatient: jest.fn() })); });
  expect(button(renderer, 'Clear TB')).toBeUndefined();
});

test('clicking a Home queue card opens the patient at their station; Discharge does not', async () => {
  global.localStorage = { getItem: () => null, setItem: () => {} };
  const onRemovePatient = jest.fn();
  const patients = [{ ...tbPatient, tb_flagged: false, tb_status: null, current_station: 'seva' }];
  try {
    await act(async () => { renderer = create(React.createElement(PatientQueue, { patients, onRemovePatient })); });
    const card = renderer.root.find(node => node.type === 'div' && node.props['data-visit-id'] === 5);
    card.props.onClick({ target: { closest: () => null } });
    expect(push).toHaveBeenCalledWith('/seva?visit=5');
    button(renderer, 'Dara').props.onClick();
    expect(push).toHaveBeenCalledTimes(2);

    push.mockClear();
    const discharge = renderer.root.findAllByType('button').find(node => node.props.title === 'Discharge patient');
    card.props.onClick({ target: { closest: () => discharge } });
    discharge.props.onClick();
    expect(push).not.toHaveBeenCalled();
    expect(onRemovePatient).toHaveBeenCalledWith(5);
  } finally {
    delete global.localStorage;
  }
});

test('the Home queue card lets a user discharge a TB patient, but not clear TB', async () => {
  global.localStorage = { getItem: () => null, setItem: () => {} };
  try {
    await act(async () => { renderer = create(React.createElement(PatientQueue, { patients: [tbPatient], onRemovePatient: jest.fn() })); });
    expect(renderer.root.findAllByType('button').find(node => node.props.title === 'Discharge patient').props.disabled).toBeFalsy();
    expect(button(renderer, 'Clear TB')).toBeUndefined();
  } finally {
    delete global.localStorage;
  }
});

test('a patient done at this station is marked "Done here" on their card', async () => {
  stationPatients = [{ ...tbPatient, tb_flagged: false, tb_status: null, station_done: true }, { ...tbPatient, visit_id: 6, tb_flagged: false, tb_status: null }];
  await act(async () => { renderer = create(React.createElement(QueuePatientPicker, { station: 'consultation', onSelectPatient: jest.fn() })); });
  const card = id => label(renderer.root.find(node => node.type === 'div' && node.props['data-visit-id'] === id));
  expect(card(5)).toMatch(/Done here/);
  expect(card(6)).not.toMatch(/Done here/);
});
