const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/lib/api/patients/getPatient', () => ({ getPatient: jest.fn().mockResolvedValue({ id: 1, english_name: 'Patient' }) }));
jest.mock('../src/lib/api/visit/doctors-consultation/getConsultation', () => ({ getConsultation: jest.fn() }));
jest.mock('../src/lib/api/visit/doctors-consultation/postConsultation', () => ({ postConsultation: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/components/shared/read-only/patient-container/referral/ReferralButton', () => ({
  __esModule: true, default: () => React.createElement('button', { type: 'button' }, 'Create/Edit Referral'),
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const { getConsultation } = require('../src/lib/api/visit/doctors-consultation/getConsultation');
const { postConsultation } = require('../src/lib/api/visit/doctors-consultation/postConsultation');
const DoctorsNotesContainer = require('../src/components/doctors-consultation/DoctorsNotesContainer').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test.each([false, true])('referral disclosure restores %s and saves changes without losing notes', async initial => {
  getConsultation.mockResolvedValue({ notes: 'Existing notes', prescription: 'Existing prescription', requireReferral: initial, referral: null });
  postConsultation.mockClear();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(DoctorsNotesContainer, { patient: { visit_id: 1, patient_id: 1 } })); });
    const toggle = () => renderer.root.findAllByType('button').find(n => n.props['aria-controls']);
    const panel = () => renderer.root.findAllByType('div').find(n => n.props.id === toggle().props['aria-controls']);
    const save = () => renderer.root.findAllByType('button').find(n => n.children.join('') === 'Save consultation notes');
    expect(toggle().props['aria-expanded']).toBe(initial);
    expect(panel().props.inert).toBe(!initial);
    await act(async () => renderer.root.findAllByType('textarea')[0].props.onChange({ target: { value: 'Updated notes' } }));
    await act(async () => toggle().props.onClick());
    expect(toggle().props['aria-pressed']).toBe(!initial);
    expect(panel().props.inert).toBe(initial);
    await act(async () => save().props.onClick());
    expect(postConsultation).toHaveBeenCalledWith(expect.objectContaining({
      notes: 'Updated notes', prescription: 'Existing prescription', requireReferral: !initial,
    }), 1);
    await act(async () => toggle().props.onClick());
    expect(renderer.root.findAllByType('textarea')[0].props.value).toBe('Updated notes');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});
