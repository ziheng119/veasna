// "Add to family" on Patient List rows (components/patient-list/FamilyButton.tsx) and families shown
// together in the list (PatientTable.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role: 'user' } }) }));
jest.mock('../src/lib/api/family', () => ({
  joinFamily: jest.fn(async () => ({ family: 'A', patients: [] })),
  leaveFamily: jest.fn(async () => ({ patient_id: 2, family: null })),
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../src/components/ui/button', () => ({ Button: props => require('react').createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => require('react').createElement('input', props) }));
jest.mock('../src/assets/icons', () => ({ EyeIcon: () => null, TrashIcon: () => null, PersonIcon: () => null }));
// The pop-up renders in place (no portal) so it can be read and clicked.
jest.mock('../src/components/ui/dialog', () => {
  const { createElement } = require('react');
  const part = name => ({ children }) => createElement('div', { 'data-dialog': name }, children);
  return {
    Dialog: ({ open, children }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    DialogContent: part('content'), DialogHeader: part('header'), DialogFooter: part('footer'),
    DialogTitle: part('title'), DialogDescription: part('description'),
  };
});
const toast = require('react-hot-toast').default;
const { joinFamily, leaveFamily } = require('../src/lib/api/family');
const FamilyButton = require('../src/components/patient-list/FamilyButton').default;
const { PatientTable } = require('../src/components/patient-list/PatientTable');
global.IS_REACT_ACT_ENVIRONMENT = true;

const person = (id, english_name, family = null) => ({ id, english_name, family, date_of_birth: '2000-01-01' });
// Mother and Father Tan are not grouped yet; the Sok family (B) is Sok and Sok Junior; Vanna is alone.
const patients = [person(1, 'Mother Tan'), person(2, 'Father Tan'), person(3, 'Sok', 'B'), person(4, 'Sok Junior', 'B'), person(5, 'Vanna')];
const father = patients[1];

const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
const buttons = () => renderer.root.findAllByType('button');
const button = label => buttons().find(node => node.props['aria-label'] === label || text(node).includes(label));
const options = () => renderer.root.findAll(node => node.props.role === 'option' && node.type === 'button');
const confirmButton = () => renderer.root.findByProps({ 'data-dialog': 'footer' }).findAllByType('button')[1];
const dialogText = () => text(renderer.root.findByProps({ role: 'dialog' }));
const search = value => act(async () => renderer.root.findByType('input').props.onChange({ target: { value } }));

let renderer, onOpenChange, onChanged;
beforeEach(() => { onOpenChange = jest.fn(); onChanged = jest.fn(async () => {}); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; jest.clearAllMocks(); });
const render = async (patient = father, list = patients) => {
  await act(async () => { renderer = create(React.createElement(FamilyButton, { patient, patients: list, onOpenChange, onChanged })); });
};
const open = (name = 'Father Tan') => act(async () => button(`Add ${name} to a family`).props.onClick());

test('a pop-up opens over the list and tells the row; nothing is listed until a search', async () => {
  await render();
  expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
  await open();
  expect(onOpenChange).toHaveBeenCalledWith(true);
  expect(dialogText()).toMatch(/Type to search the patient list/);
  expect(options()).toHaveLength(0);
  expect(confirmButton().props.disabled).toBe(true);
  expect(dialogText()).not.toMatch(/Remove/);
});

test('searching shows families as one box and single patients; picking one, then confirming, adds this patient', async () => {
  await render();
  await open();
  await search('so');
  // The whole Sok family is one result, with both members.
  expect(options().map(o => o.props['aria-label'])).toEqual(['Family B: Sok, Sok Junior']);
  await search('tan');
  expect(options().map(o => o.props['aria-label'])).toEqual(['Mother Tan']);
  // Nothing happens until one is picked and confirmed.
  expect(joinFamily).not.toHaveBeenCalled();
  await act(async () => options()[0].props.onClick());
  expect(options()[0].props['aria-selected']).toBe(true);
  expect(text(confirmButton())).toBe('Make a family with Mother Tan');
  await act(async () => confirmButton().props.onClick());
  expect(joinFamily).toHaveBeenCalledWith(2, 1, 't');
  expect(toast.success.mock.calls[0][0]).toBe('Father Tan is now in family A with Mother Tan.');
  // The list is reloaded and the pop-up closes.
  expect(onChanged).toHaveBeenCalled();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
});

test('a family can be found by its letter and joined; picking again unselects', async () => {
  joinFamily.mockResolvedValueOnce({ family: 'B', patients: [] });
  await render();
  await open();
  await search('b');
  const family = options().find(o => o.props['aria-label'].startsWith('Family B'));
  await act(async () => family.props.onClick());
  await act(async () => options().find(o => o.props['aria-selected']).props.onClick());
  expect(confirmButton().props.disabled).toBe(true);
  await act(async () => options().find(o => o.props['aria-label'].startsWith('Family B')).props.onClick());
  expect(text(confirmButton())).toBe('Add to family B');
  await act(async () => confirmButton().props.onClick());
  expect(joinFamily).toHaveBeenCalledWith(2, 3, 't');
  expect(toast.success.mock.calls[0][0]).toBe('Father Tan is now in family B with Sok, Sok Junior.');
});

test('a patient in a family sees who with, can be taken out, and their own family is not offered', async () => {
  const list = [person(1, 'Mother Tan', 'A'), person(2, 'Father Tan', 'A'), person(5, 'Vanna')];
  await render(list[1], list);
  await open();
  expect(dialogText()).toMatch(/With Mother Tan/);
  await search('tan');
  expect(options()).toHaveLength(0);
  await act(async () => button('Remove from family').props.onClick());
  expect(leaveFamily).toHaveBeenCalledWith(2, 't');
  expect(toast.success.mock.calls[0][0]).toBe('Father Tan is no longer in a family.');
  expect(onChanged).toHaveBeenCalled();
});

describe('Patient List', () => {
  test('families sit side by side, each marked by its letter, without changing the rows', async () => {
    const list = [person(1, 'Ann'), person(2, 'Bo Tan', 'A'), person(3, 'Chan'), person(4, 'Dara Tan', 'A')];
    await act(async () => { renderer = create(React.createElement(PatientTable, { patients: list })); });
    const rows = renderer.root.findAllByType('tr').slice(1);
    expect(rows.map(row => text(row.findAllByType('td')[0]))).toEqual(['Ann', 'Bo TanA', 'Dara TanA', 'Chan']);
    expect(rows.map(row => row.props['data-family'])).toEqual([undefined, 'A', 'A', undefined]);
    expect(rows.every(row => row.props.className.includes('h-16'))).toBe(true);
  });

  test('the row whose pop-up is open is highlighted; the search covers the whole list, not just the rows shown', async () => {
    await act(async () => {
      renderer = create(React.createElement(PatientTable, { patients: [father], allPatients: patients, onFamilyChanged: onChanged }));
    });
    await open();
    expect(renderer.root.findAllByType('tr')[1].props['aria-current']).toBe(true);
    await search('vanna');
    expect(options().map(o => o.props['aria-label'])).toEqual(['Vanna']);
  });
});
