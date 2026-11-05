// "Add to family" on Patient List rows (components/patient-list/FamilyButton.tsx) and families shown
// together in the list (PatientTable.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role: 'user' } }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/lib/api/queue/getQueue', () => ({ CLINIC_TODAY: null, getQueue: jest.fn() }));
jest.mock('../src/lib/api/family', () => ({
  joinFamily: jest.fn(async () => ({ family: 'A', visits: [] })),
  leaveFamily: jest.fn(async () => ({ visit_id: 14, queue_no: '4', family: null })),
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../src/components/ui/button', () => ({ Button: props => require('react').createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => require('react').createElement('input', props) }));
// The pop-up renders in place (no portal) so it can be read and clicked.
jest.mock('../src/components/ui/dialog', () => {
  const { createElement } = require('react');
  const part = name => ({ children }) => createElement('div', { 'data-dialog': name }, children);
  return {
    Dialog: ({ open, children }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    DialogContent: part('content'), DialogHeader: part('header'), DialogTitle: part('title'), DialogDescription: part('description'),
  };
});
const toast = require('react-hot-toast').default;
const { getQueue } = require('../src/lib/api/queue/getQueue');
const { joinFamily, leaveFamily } = require('../src/lib/api/family');
const FamilyButton = require('../src/components/patient-list/FamilyButton').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

// Today's queue: mother 3 and father 4 of the Tan family (not grouped yet); the Sok family (B) is 5 and 6.
const queue = [
  { visit_id: 13, patient_id: 1, queue_no: '3', english_name: 'Mother Tan' },
  { visit_id: 14, patient_id: 2, queue_no: '4', english_name: 'Father Tan' },
  { visit_id: 15, patient_id: 3, queue_no: '5', english_name: 'Sok', family: 'B' },
  { visit_id: 16, patient_id: 4, queue_no: '6', english_name: 'Sok Junior', family: 'B' },
];
const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
const buttons = () => renderer.root.findAllByType('button');
const button = label => buttons().find(node => text(node).includes(label) || node.props['aria-label']?.includes(label));
const dialogText = () => text(renderer.root.findByProps({ role: 'dialog' }));

let renderer, onOpenChange;
beforeEach(() => { global.window = new EventTarget(); getQueue.mockResolvedValue(queue); onOpenChange = jest.fn(); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; delete global.window; jest.clearAllMocks(); });
const render = async (patientId = 2, patientName = 'Father Tan') => {
  await act(async () => { renderer = create(React.createElement(FamilyButton, { patientId, patientName, onOpenChange })); });
};
const open = (name = 'Father Tan') => act(async () => button(`Add ${name} to a family`).props.onClick());

test('a pop-up opens over the list, telling the row; today\'s queue loads only then', async () => {
  await render();
  expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
  expect(getQueue).not.toHaveBeenCalled();
  await open();
  expect(onOpenChange).toHaveBeenCalledWith(true);
  expect(getQueue).toHaveBeenCalledWith(1, null, 't', undefined, expect.anything());
  expect(dialogText()).toMatch(/Number 4\. Queue numbers stay the same/);
  // Existing families to join, and others to start a family with.
  expect(button('Join family B')).toBeDefined();
  expect(dialogText()).toMatch(/5 Sok, 6 Sok Junior/);
  expect(button('Mother Tan')).toBeDefined();
  expect(dialogText()).not.toMatch(/Remove/);
});

test('starting a family with someone; the pop-up closes', async () => {
  await render();
  await open();
  await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'mother' } }));
  expect(button('Join family B')).toBeUndefined();
  await act(async () => button('Mother Tan').props.onClick());
  expect(joinFamily).toHaveBeenCalledWith(14, 13, 't');
  expect(toast.success.mock.calls[0][0]).toBe('Father Tan (4) is in family A with Mother Tan (3).');
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
});

test('joining any existing family, found by its letter', async () => {
  joinFamily.mockResolvedValueOnce({ family: 'B', visits: [] });
  await render();
  await open();
  await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'b' } }));
  await act(async () => button('Join family B').props.onClick());
  expect(joinFamily).toHaveBeenCalledWith(14, 15, 't');
  expect(toast.success.mock.calls[0][0]).toBe('Father Tan (4) is in family B with Sok (5).');
});

test('a patient already in a family can be taken out', async () => {
  getQueue.mockResolvedValue([queue[0], { ...queue[1], family: 'A' }]);
  await render();
  await open();
  expect(dialogText()).toMatch(/Number 4, in family A/);
  await act(async () => button('Remove from family A').props.onClick());
  expect(leaveFamily).toHaveBeenCalledWith(14, 't');
  expect(toast.success.mock.calls[0][0]).toBe('Father Tan (4) is no longer in a family.');
});

test('a patient not in today\'s queue is told so, with nothing to pick', async () => {
  await render(99, 'Visitor');
  await open('Visitor');
  expect(dialogText()).toMatch(/Visitor isn't in today's queue/);
  expect(button('Mother Tan')).toBeUndefined();
});

describe('Patient List', () => {
  jest.mock('../src/assets/icons', () => ({ EyeIcon: () => null, TrashIcon: () => null, PersonIcon: () => null }));
  const { PatientTable } = require('../src/components/patient-list/PatientTable');
  const person = (id, english_name, day_family = null) => ({ id, english_name, day_family, date_of_birth: '2000-01-01' });

  test('families sit side by side, each marked by its letter, without changing the rows', async () => {
    const patients = [person(1, 'Ann'), person(2, 'Bo Tan', 'A'), person(3, 'Chan'), person(4, 'Dara Tan', 'A')];
    await act(async () => { renderer = create(React.createElement(PatientTable, { patients })); });
    const rows = renderer.root.findAllByType('tr').slice(1);
    expect(rows.map(row => text(row.findAllByType('td')[0]))).toEqual(['Ann', 'Bo TanA', 'Dara TanA', 'Chan']);
    expect(rows.map(row => row.props['data-family'])).toEqual([undefined, 'A', 'A', undefined]);
    // Every row keeps the same height class.
    expect(rows.every(row => row.props.className.includes('h-16'))).toBe(true);
  });

  test('the row whose pop-up is open is highlighted', async () => {
    await act(async () => { renderer = create(React.createElement(PatientTable, { patients: [person(2, 'Father Tan'), person(5, 'Sok')] })); });
    await open();
    const [father, sok] = renderer.root.findAllByType('tr').slice(1);
    expect(father.props['aria-current']).toBe(true);
    expect(sok.props['aria-current']).toBeUndefined();
  });
});
