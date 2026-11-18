jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { role: 'admin' } }) }));
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/lib/api/patients/getPatient', () => ({ getPatient: jest.fn().mockResolvedValue({ id: 1, english_name: 'Patient' }) }));
jest.mock('../src/lib/api/visit/doctors-consultation/getConsultation', () => ({ getConsultation: jest.fn() }));
jest.mock('../src/lib/api/visit/doctors-consultation/postConsultation', () => ({ postConsultation: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/components/shared/read-only/patient-container/referral/ReferralPopUp', () => ({
  __esModule: true, default: props => props.showPopUp ? React.createElement('referral-editor', props) : null,
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
// Tested on their own in consultationPanels.test.js.
jest.mock('../src/components/doctors-consultation/DentalSummary', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/doctors-consultation/SendToPhysiotherapy', () => ({ __esModule: true, default: () => null }));
const { getConsultation } = require('../src/lib/api/visit/doctors-consultation/getConsultation');
const { postConsultation } = require('../src/lib/api/visit/doctors-consultation/postConsultation');
const DoctorsNotesContainer = require('../src/components/doctors-consultation/DoctorsNotesContainer').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

// The notes and conditions autosave a moment after the doctor stops typing or ticking.
const autosave = async () => {
  await act(async () => { jest.advanceTimersByTime(1500); });
  await act(async () => {});
};
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('referral button follows saved record and deletion without losing notes', async () => {
  getConsultation.mockResolvedValue({ notes: 'Existing notes', prescription: 'Existing prescription', requireReferral: false, referral: null });
  postConsultation.mockClear();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let renderer;
  const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
  const button = label => renderer.root.findAllByType('button').find(n => text(n) === label);
  try {
    await act(async () => { renderer = create(React.createElement(DoctorsNotesContainer, { patient: { visit_id: 1, patient_id: 1 } })); });
    expect(button('Create referral')).toBeDefined();
    // Nothing changed yet: nothing is saved.
    await autosave();
    expect(postConsultation).not.toHaveBeenCalled();
    await act(async () => renderer.root.findAllByType('textarea')[0].props.onChange({ target: { value: 'Updated notes' } }));
    await act(async () => button('Create referral').props.onClick());
    const editor = () => renderer.root.findByType('referral-editor');
    await act(async () => { editor().props.onSaved({ referralDate: '2026-10-20', referralType: ['Dentist'] }); editor().props.setShowPopUp(false); });
    expect(button('Edit referral')).toBeDefined();
    await autosave();
    expect(postConsultation).toHaveBeenCalledTimes(1);
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'Updated notes', requireReferral: true }), 1);
    // Quiet: no success toast, and the footer says it's saved and what the visit has.
    expect(require('react-hot-toast').default.success).not.toHaveBeenCalled();
    expect(text(renderer.root)).toMatch(/Saved \d/);
    expect(text(renderer.root)).toContain('This visit: Hospital referral');
    await act(async () => button('Edit referral').props.onClick());
    expect(editor().props.retrievedReferral.referralType).toEqual(['Dentist']);
    await act(async () => { editor().props.onDeleted(); editor().props.setShowPopUp(false); });
    expect(button('Create referral')).toBeDefined();
    expect(renderer.root.findAllByType('textarea')[0].props.value).toBe('Updated notes');
    await act(async () => renderer.root.findAllByType('textarea')[0].props.onChange({ target: { value: 'Updated notes again' } }));
    await autosave();
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'Updated notes again', requireReferral: false }), 1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});

test('loads and saves condition selections, including an explicit none choice', async () => {
  getConsultation.mockResolvedValue({ notes: 'Existing', prescription: '', referral: null, conditionCategories: ['diabetes'] });
  postConsultation.mockClear();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(DoctorsNotesContainer, {patient:{visit_id:2,patient_id:1}})); });
    const boxes=()=>renderer.root.findAllByType('input').filter(node=>node.props.type==='checkbox');
    expect(boxes()).toHaveLength(8);
    expect(boxes()[0].props.checked).toBe(true);
    await act(async()=>boxes()[1].props.onChange({target:{checked:true}}));
    await autosave();
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({conditionCategories:['diabetes','hypertension']}),2);
    await act(async()=>boxes()[7].props.onChange({target:{checked:true}}));
    expect(boxes().slice(0,7).every(node=>!node.props.checked)).toBe(true);
    await autosave();
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({conditionCategories:[]}),2);
  } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('says what is still needed to finish, and saves what was typed when another patient is opened first', async () => {
  getConsultation.mockResolvedValue(null);
  postConsultation.mockClear();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(DoctorsNotesContainer, { patient: { visit_id: 3, patient_id: 1 } })); });
    expect(text(renderer.root)).toContain('Write notes and tick the conditions addressed (or None) to finish.');
    await act(async () => renderer.root.findAllByType('textarea')[0].props.onChange({ target: { value: 'Headache' } }));
    expect(text(renderer.root)).toContain('Tick the conditions addressed (or None) to finish.');
    // Closed before the pause is up: still saved.
    await act(async () => renderer.unmount());
    renderer = null;
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'Headache' }), 3);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});
