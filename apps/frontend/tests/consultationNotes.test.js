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
const { getConsultation } = require('../src/lib/api/visit/doctors-consultation/getConsultation');
const { postConsultation } = require('../src/lib/api/visit/doctors-consultation/postConsultation');
const DoctorsNotesContainer = require('../src/components/doctors-consultation/DoctorsNotesContainer').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test('referral button follows saved record and deletion without losing notes', async () => {
  getConsultation.mockResolvedValue({ notes: 'Existing notes', prescription: 'Existing prescription', requireReferral: false, referral: null });
  postConsultation.mockClear();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let renderer;
  const button = label => renderer.root.findAllByType('button').find(n => n.children.join('') === label);
  try {
    await act(async () => { renderer = create(React.createElement(DoctorsNotesContainer, { patient: { visit_id: 1, patient_id: 1 } })); });
    expect(button('Create referral')).toBeDefined();
    await act(async () => renderer.root.findAllByType('textarea')[0].props.onChange({ target: { value: 'Updated notes' } }));
    await act(async () => button('Create referral').props.onClick());
    const editor = () => renderer.root.findByType('referral-editor');
    await act(async () => { editor().props.onSaved({ referralDate: '2026-10-20', referralType: ['Dentist'] }); editor().props.setShowPopUp(false); });
    expect(button('Edit referral')).toBeDefined();
    await act(async () => button('Save consultation notes').props.onClick());
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'Updated notes', requireReferral: true }), 1);
    await act(async () => button('Edit referral').props.onClick());
    expect(editor().props.retrievedReferral.referralType).toEqual(['Dentist']);
    await act(async () => { editor().props.onDeleted(); editor().props.setShowPopUp(false); });
    expect(button('Create referral')).toBeDefined();
    expect(renderer.root.findAllByType('textarea')[0].props.value).toBe('Updated notes');
    await act(async () => button('Save consultation notes').props.onClick());
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({ requireReferral: false }), 1);
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
    const save=()=>renderer.root.findAllByType('button').find(node=>node.children.join('')==='Save consultation notes').props.onClick();
    await act(async()=>save());
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({conditionCategories:['diabetes','hypertension']}),2);
    await act(async()=>boxes()[7].props.onChange({target:{checked:true}}));
    expect(boxes().slice(0,7).every(node=>!node.props.checked)).toBe(true);
    await act(async()=>save());
    expect(postConsultation).toHaveBeenLastCalledWith(expect.objectContaining({conditionCategories:[]}),2);
  } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});
