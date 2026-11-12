// Next on a station queue card saves what was typed into the open patient's form first
// (useSaveBeforeNext in components/shared/StationFlow.tsx), and Past visits on a returning patient's
// card opens their earlier visits (components/shared/QueuePatientPicker.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push }), usePathname: () => '/dental', useSearchParams: () => new URLSearchParams() }));
jest.mock('../src/stores/useUserStore', () => {
  const { create } = require('zustand'); return { useUserStore: create(() => ({ user: { id: 2, role: 'user', token: 't' } })) };
});
jest.mock('../src/components/shared/PageCard', () => ({ PageCard: ({ action, headerExtra, children }) => React.createElement('section', null, action, headerExtra, children) }));
jest.mock('../src/components/ui/badge', () => ({ Badge: ({ children }) => React.createElement('span', null, children) }));
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => React.createElement('input', props) }));
let queue = [];
jest.mock('../src/hooks/useLiveList', () => ({ useLiveList: () => ({ data: queue, refresh: jest.fn() }) }));
jest.mock('../src/components/shared/EditStationsDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/lib/api/queue/stations', () => ({ completeStation: jest.fn(async () => ({ held: false, next_station: 'consultation', family_moved: [], waiting_for: [] })) }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const { completeStation } = require('../src/lib/api/queue/stations');
const { StationFlowProvider, useSaveBeforeNext } = require('../src/components/shared/StationFlow');
const QueuePatientPicker = require('../src/components/shared/QueuePatientPicker').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

const label = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : label(child))).join('');
const button = (text) => renderer.root.findAllByType('button').find(node => label(node).includes(text));
const patient = (visit_id, extra = {}) => ({ visit_id, patient_id: visit_id + 100, queue_no: String(visit_id), english_name: `P${visit_id}`, timestamp: '08:00 AM', stations: [{ station: 'dental', completed: false }, { station: 'consultation', completed: false }], ...extra });

// A station form: `version` stands for "loaded or last saved"; typing changes `notes`.
let setNotes, setVersion;
const save = jest.fn();
function Form({ visitId }) {
  const [notes, set] = React.useState('');
  const [version, setV] = React.useState('loaded');
  setNotes = set; setVersion = setV;
  useSaveBeforeNext(visitId, version, { notes }, save);
  return null;
}

let renderer;
const mount = async (formVisit = 1) => {
  await act(async () => {
    renderer = create(React.createElement(StationFlowProvider, { station: 'dental', onSelectPatient: jest.fn() },
      React.createElement(Form, { visitId: formVisit }),
      React.createElement(QueuePatientPicker, { station: 'dental', onSelectPatient: jest.fn(), selectedVisitId: formVisit })));
  });
};
beforeEach(() => {
  global.window = Object.assign(new EventTarget(), { confirm: jest.fn(() => true) });
  queue = [patient(1), patient(2, { previous_visits: 2 })]; save.mockReset(); save.mockResolvedValue(true);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; delete global.window; jest.clearAllMocks(); });
const nextOn = visitId => renderer.root.findAll(node => node.props['data-visit-id'] === visitId)[0]
  .findAllByType('button').find(node => label(node).trim() === 'Next');

test('Next saves the notes typed so far, then sends the patient on', async () => {
  await mount();
  await act(async () => setNotes('Two fillings done'));
  const order = [];
  save.mockImplementation(async () => { order.push('save'); return true; });
  completeStation.mockImplementationOnce(async () => { order.push('move'); return { held: false, next_station: 'consultation', family_moved: [], waiting_for: [] }; });
  await act(async () => nextOn(1).props.onClick());
  expect(order).toEqual(['save', 'move']);
});

test('nothing typed, or already saved: Next only sends the patient on', async () => {
  await mount();
  await act(async () => nextOn(1).props.onClick());
  expect(save).not.toHaveBeenCalled();
  expect(completeStation).toHaveBeenCalledWith(1, 'dental', 't');
  // Typed, then saved with the form's own button: the saved values count as unchanged.
  await act(async () => setNotes('Cleaned'));
  await act(async () => setVersion('saved-1'));
  await act(async () => nextOn(1).props.onClick());
  expect(save).not.toHaveBeenCalled();
});

test('a failed save keeps the patient here; another patient\'s Next never saves this form', async () => {
  await mount();
  await act(async () => setNotes('Unsaved'));
  save.mockResolvedValue(false);
  await act(async () => nextOn(1).props.onClick());
  expect(completeStation).not.toHaveBeenCalled();
  await act(async () => nextOn(2).props.onClick());
  expect(save).toHaveBeenCalledTimes(1);
  expect(completeStation).toHaveBeenCalledWith(2, 'dental', 't');
});

test('Past visits shows only for a returning patient and opens their record, coming back to this queue', async () => {
  await mount(2);
  expect(renderer.root.findAll(node => node.props['data-visit-id'] === 1)[0].findAllByType('button').some(node => label(node).includes('Past visits'))).toBe(false);
  expect(label(button('Past visits'))).toContain('Past visits (2)');
  await act(async () => setNotes('Typed before leaving'));
  await act(async () => button('Past visits').props.onClick());
  expect(save).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith(`/patient-details?id=102&from=${encodeURIComponent('/dental?visit=2')}`);
});
