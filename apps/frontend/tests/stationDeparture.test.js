// The open patient moved on from another device: their typing is saved, their forms close and the
// empty panel says where they went (patientLeft and StationDepartureNotice in
// components/shared/StationFlow.tsx, detected by components/shared/QueuePatientPicker.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
const h = React.createElement;
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), usePathname: () => '/dental', useSearchParams: () => new URLSearchParams() }));
jest.mock('../src/stores/useUserStore', () => {
  const { create } = require('zustand'); return { useUserStore: create(() => ({ user: { id: 2, role: 'user', token: 't' } })) };
});
jest.mock('../src/components/shared/PageCard', () => ({ PageCard: ({ action, headerExtra, children }) => require('react').createElement('section', null, action, headerExtra, children) }));
jest.mock('../src/components/ui/badge', () => ({ Badge: ({ children }) => require('react').createElement('span', null, children) }));
jest.mock('../src/components/ui/button', () => ({ Button: props => require('react').createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => require('react').createElement('input', props) }));
let queue = [];
jest.mock('../src/hooks/useLiveList', () => ({ useLiveList: () => ({ data: queue, refresh: jest.fn(), loaded: true }) }));
jest.mock('../src/components/shared/EditStationsDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/lib/api/queue/stations', () => ({ completeStation: jest.fn(async () => ({ held: false, next_station: 'consultation', family_moved: [], waiting_for: [] })) }));
jest.mock('../src/lib/api/visit/getVisit', () => ({ getVisit: jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const { getVisit } = require('../src/lib/api/visit/getVisit');
const { StationFlowProvider, StationDonePrompt, useSaveBeforeNext, departureMessage } = require('../src/components/shared/StationFlow');
const QueuePatientPicker = require('../src/components/shared/QueuePatientPicker').default;
const NoPatientSelected = require('../src/components/shared/NoPatientSelected').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

const text = node => (node.children ?? []).flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
const patient = (visit_id, extra = {}) => ({ visit_id, patient_id: visit_id + 100, queue_no: String(visit_id), english_name: `P${visit_id}`, timestamp: '08:00 AM', stations: [{ station: 'dental', completed: false }, { station: 'consultation', completed: false }], ...extra });

// A station page: the open patient's form, or the empty panel.
let setNotes, open;
const save = jest.fn();
function Form({ patient: p }) {
  const [notes, set] = React.useState('');
  setNotes = set;
  useSaveBeforeNext(p.visit_id, 'loaded', { notes }, save);
  return h('form', { id: 'form' }, h(StationDonePrompt, { patient: p, done: false }));
}
function Page() {
  const [selected, setSelected] = React.useState(queue[0]);
  open = selected;
  return h(StationFlowProvider, { station: 'dental', onSelectPatient: setSelected },
    selected ? h(Form, { key: selected.visit_id, patient: selected }) : h(NoPatientSelected),
    h(QueuePatientPicker, { station: 'dental', onSelectPatient: setSelected, selectedVisitId: selected?.visit_id }));
}

let renderer;
const mount = async () => { await act(async () => { renderer = create(h(Page)); }); };
// Another device moved patients: the live queue no longer has them.
const queueBecomes = async patients => { queue = patients; await act(async () => renderer.update(h(Page))); };
const shown = () => text(renderer.root);
beforeEach(() => {
  global.window = Object.assign(new EventTarget(), { confirm: jest.fn(() => true) });
  queue = [patient(1), patient(2)];
  save.mockReset(); save.mockResolvedValue(true);
  getVisit.mockResolvedValue({ completed_at: null, stations: [{ station: 'dental', completed_at: '2026-11-10T02:00:00Z' }, { station: 'pharmacy', completed_at: null }] });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; delete global.window; jest.clearAllMocks(); });

test('sent on from another device: typing is saved, the form closes, and the panel says where they went', async () => {
  await mount();
  await act(async () => setNotes('Two fillings done'));
  await queueBecomes([patient(2)]);
  expect(save).toHaveBeenCalledTimes(1);
  expect(open).toBeNull();
  expect(renderer.root.findAll(node => node.props.id === 'form')).toHaveLength(0);
  expect(shown()).toContain('Queue 1, P1, was sent to Pharmacy from another device.');
  expect(shown()).toContain('What you had typed for them was saved first.');
  // Opening the next patient replaces the note.
  const pick = renderer.root.findAll(node => node.type === 'button' && /^Select P2/.test(node.props['aria-label'] ?? ''))[0];
  await act(async () => pick.props.onClick());
  expect(open.visit_id).toBe(2);
  // Moving P2 on here empties the panel again, without the old note.
  const next = renderer.root.findAll(node => node.props['data-visit-id'] === 2)[0]
    .findAllByType('button').find(node => text(node).trim() === 'Next');
  await act(async () => next.props.onClick());
  await queueBecomes([]);
  expect(open).toBeNull();
  expect(shown()).toContain('No Patient Selected');
  expect(shown()).not.toContain('from another device');
});

test('nothing typed: nothing is saved; a finished visit says so', async () => {
  getVisit.mockResolvedValue({ completed_at: '2026-11-10T03:00:00Z', stations: [] });
  await mount();
  await queueBecomes([patient(2)]);
  expect(save).not.toHaveBeenCalled();
  expect(shown()).toContain('Queue 1, P1, finished their visit on another device.');
  expect(shown()).not.toContain('was saved first');
});

test('if the save fails the form stays open with the reason, until closed', async () => {
  save.mockResolvedValue(false);
  await mount();
  await act(async () => setNotes('Snellen 6/x'));
  await queueBecomes([patient(2)]);
  expect(open.visit_id).toBe(1);
  const alert = renderer.root.findByProps({ role: 'alert' });
  expect(text(alert)).toContain("was sent to Pharmacy from another device. What you typed here isn't saved");
  await act(async () => renderer.root.findAllByType('button').find(node => text(node) === 'Close patient').props.onClick());
  expect(open).toBeNull();
  expect(shown()).toContain('Queue 1, P1, was sent to Pharmacy from another device.');
});

test('moving the patient on from this device, or another patient leaving, shows nothing', async () => {
  await mount();
  await queueBecomes([patient(1)]); // patient 2 left; patient 1 is still open
  expect(open.visit_id).toBe(1);
  expect(shown()).not.toContain('from another device');
  const next = renderer.root.findAll(node => node.props['data-visit-id'] === 1)[0]
    .findAllByType('button').find(node => text(node).trim() === 'Next');
  await act(async () => next.props.onClick());
  await queueBecomes([]);
  expect(open).toBeNull();
  expect(getVisit).not.toHaveBeenCalled();
  expect(shown()).not.toContain('from another device');
});

test('a route change that takes them off this station, or an unknown station, still reads clearly', () => {
  const left = { visitId: 1, queueNo: '12', name: 'Sok Dara', draft: null };
  expect(departureMessage({ ...left, now: 'consultation' }, 'dental')).toBe('Queue 12, Sok Dara, was sent to Consult from another device.');
  expect(departureMessage({ ...left, now: null }, 'dental')).toBe('Queue 12, Sok Dara, is no longer waiting at Dental: moved on from another device.');
});
