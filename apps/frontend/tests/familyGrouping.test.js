// "Group families" on Today's Queue: dragging cards onto each other picks one family
// (src/lib/familyGrouping.ts), and turning the switch off saves it (components/home/PatientQueue.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../src/stores/useUserStore', () => {
  const { create } = require('zustand'); return { useUserStore: create(() => ({ user: { id: 2, role: 'user', token: 't' } })) };
});
jest.mock('../src/components/shared/PageCard', () => ({ PageCard: ({ action, headerExtra, children }) => React.createElement('section', null, action, headerExtra, children) }));
jest.mock('../src/components/ui/badge', () => ({ Badge: ({ children }) => React.createElement('span', null, children) }));
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => React.createElement('input', props) }));
jest.mock('../src/lib/api/family', () => ({
  groupFamily: jest.fn(async ids => ({ family: 'C', patients: ids.map(patient_id => ({ patient_id, family: 'C' })) })),
  leaveFamily: jest.fn(async patient_id => ({ patient_id, family: null })),
}));
// Drags are played by calling the drop handler the queue gives the hook (pointer events need a browser).
let drop;
jest.mock('../src/hooks/useCardDrag', () => ({
  STAY: 0, EMPTY: -1,
  useCardDrag: onDrop => { drop = onDrop; return { draggingId: null, overId: null, onPointerDown: () => {} }; },
}));
jest.mock('react-hot-toast', () => {
  const toast = jest.fn(); toast.success = jest.fn(); toast.error = jest.fn();
  return { __esModule: true, default: toast };
});
const toast = require('react-hot-toast').default;
const { groupFamily, leaveFamily } = require('../src/lib/api/family');
const { EMPTY_DRAFT, dropOnPatient, dropOutside, draftChanges, previewFamilies } = require('../src/lib/familyGrouping');
const { PatientQueue } = require('../src/components/home/PatientQueue');
global.IS_REACT_ACT_ENVIRONMENT = true;

// 1 and 2 are family A; 3 and 4 have none; 5, 6 and 7 are family B.
const queue = [
  { patient_id: 1, family: 'A' }, { patient_id: 2, family: 'A' }, { patient_id: 3 }, { patient_id: 4 },
  { patient_id: 5, family: 'B' }, { patient_id: 6, family: 'B' }, { patient_id: 7, family: 'B' },
];
const p = id => queue.find(patient => patient.patient_id === id);

describe('picking a family', () => {
  test('a card dropped on another picks both; more cards join the same pick', () => {
    let draft = dropOnPatient(EMPTY_DRAFT, p(3), p(4), queue);
    expect(draft).toEqual({ selected: [4, 3], leaving: [] });
    expect(draftChanges(draft)).toEqual({ leave: [], group: [4, 3] });
  });

  test('dropped on a family member, the card joins that whole family', () => {
    expect(dropOnPatient(EMPTY_DRAFT, p(3), p(1), queue).selected.sort()).toEqual([1, 2, 3]);
  });

  test('a member of another family leaves it for the new one', () => {
    const draft = dropOnPatient(EMPTY_DRAFT, p(5), p(3), queue);
    expect(draft).toEqual({ selected: [3, 5], leaving: [5] });
    expect(draftChanges(draft)).toEqual({ leave: [5], group: [3, 5] });
  });

  test('dropping on a member of its own family changes nothing', () => {
    expect(dropOnPatient(EMPTY_DRAFT, p(1), p(2), queue)).toBe(EMPTY_DRAFT);
  });

  test('the preview shows the queue as saved: picked patients share the family most are in, leavers have none', () => {
    const family = draft => previewFamilies(queue, draft).map(patient => patient.family ?? null);
    expect(family(dropOnPatient(EMPTY_DRAFT, p(3), p(1), queue))).toEqual(['A', 'A', 'A', null, 'B', 'B', 'B']);
    expect(family(dropOnPatient(EMPTY_DRAFT, p(3), p(4), queue))).toEqual(['A', 'A', 'New', 'New', 'B', 'B', 'B']);
    expect(family(dropOutside(EMPTY_DRAFT, p(5)))).toEqual(['A', 'A', null, null, null, 'B', 'B']);
  });

  test('dragged out of its box, a member leaves the family; anyone else is just un-picked', () => {
    let draft = dropOutside(EMPTY_DRAFT, p(1));
    expect(draftChanges(draft)).toEqual({ leave: [1], group: null });
    draft = dropOutside(dropOnPatient(EMPTY_DRAFT, p(3), p(4), queue), p(3));
    expect(draftChanges(draft)).toEqual({ leave: [], group: null });
  });
});

describe("Today's Queue switch", () => {
  const patients = [
    { visit_id: 11, patient_id: 1, queue_no: '1', english_name: 'Mother Tan', family: 'A', timestamp: '08:00' },
    { visit_id: 12, patient_id: 2, queue_no: '2', english_name: 'Sok', timestamp: '08:05' },
    { visit_id: 13, patient_id: 3, queue_no: '3', english_name: 'Child Tan', family: 'A', timestamp: '08:10' },
    { visit_id: 14, patient_id: 4, queue_no: '4', english_name: 'Dara', timestamp: '08:15' },
  ];
  const label = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : label(child))).join('');
  let renderer;
  const onFamilyChanged = jest.fn(async () => {});
  const toggle = () => renderer.root.find(node => node.props.role === 'switch');
  const card = name => renderer.root.find(node => node.type === 'button' && (node.props['aria-label'] ?? '').includes(name));
  const familyBoxes = () => renderer.root.findAll(node => node.type === 'div' && node.props['data-family-box']);

  beforeEach(async () => {
    global.window = Object.assign(new EventTarget(), { confirm: jest.fn(() => true) });
    await act(async () => { renderer = create(React.createElement(PatientQueue, { patients, onRemovePatient: jest.fn(), onFamilyChanged })); });
  });
  afterEach(async () => {
    await act(async () => renderer.unmount());
    delete global.window; jest.clearAllMocks();
  });

  test('a family is shown together in one box, above the search', () => {
    const [box] = familyBoxes();
    expect(box.props['data-family-box']).toBe('A');
    expect(label(box)).toContain('Mother Tan');
    expect(label(box)).toContain('Child Tan');
    expect(toggle().props['aria-checked']).toBe(false);
  });

  test('cards dropped on each other are shown in one box at once; turning the switch off groups them', async () => {
    await act(async () => toggle().props.onClick());
    expect(toggle().props['aria-checked']).toBe(true);
    // Tapping a card does nothing while grouping: cards are only dragged.
    expect(card('Sok').props.disabled).toBe(true);
    await act(async () => drop(4, 2));
    const box = familyBoxes().find(node => node.props['data-family-box'] === 'New');
    expect(label(box)).toContain('Sok');
    expect(label(box)).toContain('Dara');
    await act(async () => toggle().props.onClick());
    expect(groupFamily).toHaveBeenCalledWith([2, 4], 't');
    expect(leaveFamily).not.toHaveBeenCalled();
    expect(onFamilyChanged).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Family C: 2 patients grouped.');
    expect(toggle().props['aria-checked']).toBe(false);
  });

  test('a member dragged out of the box onto empty space leaves the family on turning the switch off', async () => {
    await act(async () => toggle().props.onClick());
    // Dropped outside the queue, or back in its own box: nothing changes.
    await act(async () => drop(3, null));
    await act(async () => drop(3, 0));
    expect(familyBoxes()).toHaveLength(1);
    await act(async () => drop(3, -1));
    // Out of the box at once; Mother Tan, left alone, is no longer boxed.
    expect(familyBoxes()).toHaveLength(0);
    await act(async () => toggle().props.onClick());
    expect(leaveFamily).toHaveBeenCalledWith(3, 't');
    expect(groupFamily).not.toHaveBeenCalled();
  });

  test('one patient picked is not a family: nothing is saved', async () => {
    await act(async () => toggle().props.onClick());
    await act(async () => drop(4, 2));
    // Dragged back out onto empty space, Dara is un-picked: only Sok is left.
    await act(async () => drop(4, -1));
    await act(async () => toggle().props.onClick());
    expect(groupFamily).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Pick at least two patients to make a family.');
  });
});
