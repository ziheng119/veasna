// "Add to family" on Patient List rows (components/patient-list/FamilyButton.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('react-dom', () => ({ ...jest.requireActual('react-dom'), createPortal: element => element }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role: 'user' } }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/lib/api/queue/getQueue', () => ({ CLINIC_TODAY: null, getQueue: jest.fn() }));
jest.mock('../src/lib/api/family', () => ({
  joinFamily: jest.fn(async () => ({ family: 'A', visits: [{ visit_id: 14, queue_no: '4A' }, { visit_id: 13, queue_no: '3A' }] })),
  leaveFamily: jest.fn(async () => ({ visit_id: 14, queue_no: '4' })),
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const toast = require('react-hot-toast').default;
const { getQueue } = require('../src/lib/api/queue/getQueue');
const { joinFamily, leaveFamily } = require('../src/lib/api/family');
const FamilyButton = require('../src/components/patient-list/FamilyButton').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

// The Tan family: mother 3 and father 4 are in today's queue, with Sok (5) from another family.
const queue = [
  { visit_id: 13, patient_id: 1, queue_no: '3', english_name: 'Mother Tan' },
  { visit_id: 14, patient_id: 2, queue_no: '4', english_name: 'Father Tan' },
  { visit_id: 15, patient_id: 3, queue_no: '5B', english_name: 'Sok' },
];
const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
const buttons = () => renderer.root.findAllByType('button');
const button = label => buttons().find(node => text(node).includes(label) || node.props['aria-label']?.includes(label));

let renderer;
beforeEach(() => { global.window = new EventTarget(); global.document = { body: {} }; getQueue.mockResolvedValue(queue); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; delete global.window; delete global.document; jest.clearAllMocks(); });
const render = async (patientId = 2, patientName = 'Father Tan') => {
  await act(async () => {
    renderer = create(React.createElement(FamilyButton, { patientId, patientName }), {
      createNodeMock: () => ({ focus() {}, getBoundingClientRect: () => ({ bottom: 100, right: 400 }) }),
    });
  });
};
const openSearch = () => act(async () => button('Add Father Tan to a family').props.onClick());

test('starts as an icon; today\'s queue loads only when the search opens', async () => {
  await render();
  expect(buttons()).toHaveLength(1);
  expect(getQueue).not.toHaveBeenCalled();
  await openSearch();
  expect(getQueue).toHaveBeenCalledWith(1, null, 't', undefined, expect.anything());
  expect(text(renderer.root)).toMatch(/Mother Tan/);
  expect(text(renderer.root)).not.toMatch(/Remove/);
});

test('searching and picking a family member groups them; the new numbers are shown', async () => {
  await render();
  await openSearch();
  await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'mother' } }));
  expect(text(renderer.root)).not.toMatch(/Sok/);
  await act(async () => button('Mother Tan').props.onClick());
  expect(joinFamily).toHaveBeenCalledWith(14, 13, 't');
  expect(toast.success.mock.calls[0][0]).toBe('Father Tan is now 4A, in family A with Mother Tan (3A).');
  // Closed again.
  expect(renderer.root.findAllByType('input')).toHaveLength(0);
});

test('a patient already in a family can be taken out', async () => {
  getQueue.mockResolvedValue([{ ...queue[0], queue_no: '3A' }, { ...queue[1], queue_no: '4A' }]);
  await render();
  await openSearch();
  await act(async () => button('Remove 4A from family A').props.onClick());
  expect(leaveFamily).toHaveBeenCalledWith(14, 't');
  expect(toast.success.mock.calls[0][0]).toBe('Father Tan is now 4, not in a family.');
});

test('a patient not in today\'s queue is told so, with nothing to pick', async () => {
  await render(99, 'Visitor');
  await act(async () => button('Add Visitor to a family').props.onClick());
  expect(text(renderer.root)).toMatch(/Visitor isn't in today's queue/);
  expect(button('Mother Tan')).toBeUndefined();
});
