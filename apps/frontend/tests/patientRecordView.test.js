// Patient Details: prescriptions and stations of a visit (components/patient-details/VisitPrescriptions.tsx,
// VisitStations.tsx), and the Patient List's View button, which only the admin can use.
const React = require('react');
const { act, create } = require('react-test-renderer');
let role = 'admin';
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role } }) }));
jest.mock('../src/assets/icons', () => ({ EyeIcon: () => null, TrashIcon: () => null }));
jest.mock('../src/components/patient-list/FamilyButton', () => ({ __esModule: true, default: () => null }));
const VisitPrescriptions = require('../src/components/patient-details/VisitPrescriptions').default;
const { prescriptionTrail } = require('../src/components/patient-details/VisitPrescriptions');
const VisitStations = require('../src/components/patient-details/VisitStations').default;
const { visitStatusText } = require('../src/components/patient-details/VisitStations');
const { PatientTableRow } = require('../src/components/patient-list/PatientTableRow');
global.IS_REACT_ACT_ENVIRONMENT = true;

const text = node => (node.children ?? []).flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
const prescription = (extra) => ({ id: 1, drug_name: 'Paracetamol', quantity: 6, instructions: '1 tablet twice a day', status: 'dispensed',
  prescribed_at: '2026-06-01T02:00:00Z', prescribed_by: 'dec13village', dispensed_at: '2026-06-01T02:30:00Z', dispensed_by: 'admin',
  cancelled_at: null, cancelled_by: null, ...extra });
let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });
const render = async element => { await act(async () => { renderer = create(element); }); return text(renderer.root); };

test('prescriptions show the medicine, quantity, instructions, status and who handled them', async () => {
  const shown = await render(React.createElement(VisitPrescriptions, { prescriptions: [
    prescription({}),
    prescription({ id: 2, drug_name: 'Ibuprofen', quantity: 2, instructions: '', status: 'cancelled', dispensed_at: null, dispensed_by: null, cancelled_at: '2026-06-01T02:10:00Z', cancelled_by: 'admin' }),
    prescription({ id: 3, drug_name: 'Amoxicillin', status: 'pending', dispensed_at: null, dispensed_by: null }),
  ] }));
  for (const value of ['Paracetamol', '× 6', '1 tablet twice a day', 'Dispensed', 'Ibuprofen', 'Cancelled', 'Amoxicillin', 'Waiting at Pharmacy']) {
    expect(shown).toContain(value);
  }
  expect(prescriptionTrail(prescription({}))).toMatch(/^Prescribed .* by dec13village, dispensed .* by admin$/);
  expect(prescriptionTrail(prescription({ status: 'pending' }))).not.toContain('dispensed');
});

test('no prescriptions says so', async () => {
  expect(await render(React.createElement(VisitPrescriptions, { prescriptions: [] }))).toContain('No medicines prescribed for this visit.');
});

test('stations show the route in order, what was finished, and where the patient is now', async () => {
  const stations = [
    { station: 'triage', position: 1, entered_at: null, completed_at: '2026-06-01T01:00:00Z' },
    { station: 'consultation', position: 2, entered_at: null, completed_at: null },
    { station: 'pharmacy', position: 3, entered_at: null, completed_at: null },
  ];
  const shown = await render(React.createElement(VisitStations, { stations, completedAt: null }));
  expect(shown.indexOf('Triage')).toBeLessThan(shown.indexOf('Consult'));
  expect(shown).toContain('In the clinic, at Consult');
  expect(renderer.root.findAllByType('li').map(li => li.props.title)).toEqual([expect.stringMatching(/^Finished at/), 'Waiting here now', 'Not reached']);
  expect(visitStatusText(stations, '2026-06-01T05:00:00Z')).toMatch(/^Visit finished at/);
  await act(async () => renderer.unmount()); renderer = null;
  expect(await render(React.createElement(VisitStations, { stations: [], completedAt: null }))).toBe('');
});

test.each([['admin', false], ['user', true]])('Patient List View button for %s: disabled %s', async (who, disabled) => {
  role = who;
  const onViewPatient = jest.fn();
  const patient = { id: 7, english_name: 'Sok', khmer_name: '', date_of_birth: '1990-01-01', sex: 'M' };
  await render(React.createElement('table', null, React.createElement('tbody', null,
    React.createElement(PatientTableRow, { patient, allPatients: [patient], onViewPatient }))));
  const view = renderer.root.findByProps({ 'aria-label': 'View Sok' });
  expect(Boolean(view.props.disabled)).toBe(disabled);
  // Hovering the disabled button explains where other accounts find past visits.
  const hint = renderer.root.findAll(node => typeof node.props['aria-label'] === 'string' && node.props['aria-label'].startsWith('Only the admin'));
  expect(hint.length > 0).toBe(disabled);
  if (!disabled) {
    await act(async () => view.props.onClick());
    expect(onViewPatient).toHaveBeenCalledWith(7);
  }
});
