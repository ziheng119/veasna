// Patient Details > visit > Referral: Add referral / Sign / print opens the Consult referral form
// for that visit, after loading the saved referral (components/patient-details/ReferralFormButton.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/components/shared/read-only/patient-container/referral/ReferralPopUp', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/shared/GlassButton', () => ({ __esModule: true, default: ({ children, ...props }) => require('react').createElement('button', props, children) }));
const mockGetConsultation = jest.fn();
jest.mock('../src/lib/api/visit/doctors-consultation/getConsultation', () => ({ getConsultation: (...args) => mockGetConsultation(...args) }));
const mockToastError = jest.fn();
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: (...args) => mockToastError(...args) } }));
const ReferralPopUp = require('../src/components/shared/read-only/patient-container/referral/ReferralPopUp').default;
const ReferralFormButton = require('../src/components/patient-details/ReferralFormButton').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

const patient = { id: 61, english_name: 'ahh', date_of_birth: '2005-12-06', location_id: 1, face_id: null, lastUpdated: '' };
const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');

describe('ReferralFormButton', () => {
  let renderer;
  afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; jest.clearAllMocks(); });
  const render = async props => {
    await act(async () => { renderer = create(React.createElement(ReferralFormButton, { visitId: 20, patient, onChanged: jest.fn(), ...props })); });
  };

  test('a visit without a referral offers Add referral; one with a referral offers Sign / print', async () => {
    await render({ hasReferral: false });
    expect(text(renderer.root.findByType('button'))).toBe('Add referral');
    await act(async () => renderer.update(React.createElement(ReferralFormButton, { visitId: 20, patient, onChanged: jest.fn(), hasReferral: true })));
    expect(text(renderer.root.findByType('button'))).toBe('Sign / print');
  });

  test('loads the saved referral, then opens the form for that visit; saving reloads the visit', async () => {
    const onChanged = jest.fn();
    const saved = { referralType: ['Hospital'] };
    mockGetConsultation.mockResolvedValueOnce({ referral: saved });
    await render({ hasReferral: true, onChanged });
    expect(renderer.root.findAllByType(ReferralPopUp)).toHaveLength(0);
    await act(async () => renderer.root.findByType('button').props.onClick());
    expect(mockGetConsultation).toHaveBeenCalledWith(20);
    const popUp = renderer.root.findByType(ReferralPopUp);
    expect(popUp.props).toMatchObject({ showPopUp: true, retrievedReferral: saved, patientInfo: patient, patient: { visit_id: 20, patient_id: 61 } });
    await act(async () => popUp.props.onSaved(saved));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  test('when the referral cannot be loaded, the form stays closed and says so', async () => {
    mockGetConsultation.mockRejectedValueOnce(new Error('offline'));
    await render({ hasReferral: false });
    await act(async () => renderer.root.findByType('button').props.onClick());
    expect(renderer.root.findAllByType(ReferralPopUp)).toHaveLength(0);
    expect(mockToastError).toHaveBeenCalled();
  });
});
