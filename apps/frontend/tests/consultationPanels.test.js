// Consult page panels: the Dental station's notes, and the doctor sending the patient to
// Physiotherapy (components/doctors-consultation/DentalSummary.tsx, SendToPhysiotherapy.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role: 'user' } }) }));
jest.mock('../src/lib/api/visit/dental', () => ({ getDental: jest.fn() }));
jest.mock('../src/lib/api/queue/stations', () => ({ setStationNeeded: jest.fn(async () => ['consultation', 'physiotherapy']) }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../src/components/ui/checkbox', () => ({
  Checkbox: ({ onCheckedChange, ...props }) => require('react').createElement('input', { type: 'checkbox', ...props, onChange: e => onCheckedChange?.(e.target.checked) }),
}));
const { getDental } = require('../src/lib/api/visit/dental');
const { setStationNeeded } = require('../src/lib/api/queue/stations');
const DentalSummary = require('../src/components/doctors-consultation/DentalSummary').default;
const SendToPhysiotherapy = require('../src/components/doctors-consultation/SendToPhysiotherapy').default;
const { StationCheckboxes } = require('../src/components/shared/StationCheckboxes');
const { REGISTRATION_STATION_IDS } = require('../src/constants/stations');
global.IS_REACT_ACT_ENVIRONMENT = true;

const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; jest.clearAllMocks(); });
const render = async element => { await act(async () => { renderer = create(element); }); return text(renderer.root); };

test('the doctor sees the dental notes and a ticked, read-only "referral required" box', async () => {
  getDental.mockResolvedValue({ notes: 'Extracted lower left molar', referral_needed: true });
  const shown = await render(React.createElement(DentalSummary, { visitId: 5 }));
  expect(getDental).toHaveBeenCalledWith(5, expect.anything());
  expect(shown).toMatch(/Extracted lower left molar/);
  expect(shown).toMatch(/Referral required from Dental/);
  expect(shown).toMatch(/Write it with Create referral/);
  expect(renderer.root.findByType('input').props).toMatchObject({ checked: true, disabled: true, 'aria-readonly': 'true' });
});

test('no referral needed: the box is unticked; empty notes say so', async () => {
  getDental.mockResolvedValue({ notes: '  ', referral_needed: false });
  const shown = await render(React.createElement(DentalSummary, { visitId: 5 }));
  expect(renderer.root.findByType('input').props.checked).toBe(false);
  expect(shown).toMatch(/No notes written/);
});

test('a patient not yet seen at Dental says so; a failed load says so too', async () => {
  getDental.mockResolvedValue(null);
  let shown = await render(React.createElement(DentalSummary, { visitId: 5 }));
  expect(shown).toMatch(/Not seen at Dental yet/);
  expect(renderer.root.findByType('input').props.checked).toBe(false);
  await act(async () => renderer.unmount()); renderer = null;
  getDental.mockRejectedValue(new Error('offline'));
  shown = await render(React.createElement(DentalSummary, { visitId: 6 }));
  expect(renderer.root.findByProps({ role: 'alert' })).toBeTruthy();
  expect(shown).toMatch(/Unable to load dental notes/);
});

const patient = (extra = {}) => ({ visit_id: 5, stations: [{ station: 'consultation', completed: false }], tb_status: null, ...extra });
const box = () => renderer.root.findByType('input');

test('ticking "Refer to physiotherapy station" adds it to the route straight away, and unticking takes it off', async () => {
  const shown = await render(React.createElement(SendToPhysiotherapy, { patient: patient() }));
  expect(shown).toMatch(/Refer to physiotherapy station/);
  expect(shown).toMatch(/Only patients referred here join the Physiotherapy queue/);
  expect(box().props.checked).toBe(false);
  await act(async () => box().props.onChange({ target: { checked: true } }));
  expect(setStationNeeded).toHaveBeenLastCalledWith(5, 'physiotherapy', true, 't');
  expect(box().props.checked).toBe(true);
  expect(text(renderer.root)).toMatch(/joins the Physiotherapy queue after Consult/);
  await act(async () => box().props.onChange({ target: { checked: false } }));
  expect(setStationNeeded).toHaveBeenLastCalledWith(5, 'physiotherapy', false, 't');
});

test.each([
  ['a TB patient', patient({ tb_status: 'suspected' }), /only go to Consult/],
  ['a patient already seen there', patient({ stations: [{ station: 'physiotherapy', completed: true }] }), /Already seen/],
])('Refer to physiotherapy station is locked for %s', async (_, value, hint) => {
  const shown = await render(React.createElement(SendToPhysiotherapy, { patient: value }));
  expect(box().props.disabled).toBe(true);
  expect(shown).toMatch(hint);
});

test('registration offers Triage, Dental, Consult and the partner NGO, in clinic order', async () => {
  const shown = await render(React.createElement(StationCheckboxes, {
    idPrefix: 's', selected: [], onChange: jest.fn(), options: REGISTRATION_STATION_IDS,
  }));
  expect(renderer.root.findAllByType('input').map(input => input.props.id)).toEqual(['s-triage', 's-dental', 's-consultation', 's-seva']);
  expect(shown).not.toMatch(/Physiotherapy|Pharmacy/);
});
