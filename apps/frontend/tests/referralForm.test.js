const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { id: 1, username: 'Clinician' } }) }));
jest.mock('../src/lib/api/visit/postReferral', () => ({ postReferral: jest.fn() }));
jest.mock('../src/components/doctors-consultation/SignaturePad', () => ({ __esModule: true, default: props => React.createElement('signature-pad', props) }));
jest.mock('../src/components/doctors-consultation/ReferralDocument', () => ({ referralDocumentHtml: () => '<html>Referral</html>' }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const { postReferral } = require('../src/lib/api/visit/postReferral');
const ReferralForm = require('../src/components/doctors-consultation/Referral').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test.each([null, '2025-04-12'])('referral date defaults locally and preserves saved date %s', async savedDate => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(ReferralForm, {
      patient: { visit_id: 1 }, patientInfo: { date_of_birth: '2000-01-01' },
      retrievedReferral: savedDate ? { referralDate: savedDate, referralType: [], illness: '', duration: '', reason: '' } : null,
      onClose: jest.fn(),
    })); });
    const date = () => renderer.root.findAllByType('input').find(input => input.props.type === 'date');
    expect(date().props.value).toBe(savedDate || localDate);
    await act(async () => date().props.onChange({ target: { value: '2026-01-03' } }));
    expect(date().props.value).toBe('2026-01-03');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});

test('editing clears signature; print saves first, uses saved record, and save failures do not print', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const popup = { document: { open: jest.fn(), write: jest.fn(), close: jest.fn() }, focus: jest.fn(), print: jest.fn(), close: jest.fn() };
  global.window = { open: jest.fn(() => popup) };
  const onSaved = jest.fn(), onClose = jest.fn();
  let renderer;
  const signature = [[[0, 0], [1, 1]]];
  const sign = () => renderer.root.findByType('signature-pad').props.onChange(signature);
  const print = () => renderer.root.findAllByType('button').find(n => n.children.join('') === 'Save & print referral').props.onClick();
  try {
    await act(async () => { renderer = create(React.createElement(ReferralForm, {
      patient: { visit_id: 1 }, patientInfo: { english_name: 'Patient', date_of_birth: '2000-01-01' },
      retrievedReferral: null, onSaved, onClose,
    })); });
    await act(async () => print());
    expect(window.open).not.toHaveBeenCalled(); // Unsigned printing is blocked.
    await act(async () => sign());
    await act(async () => renderer.root.findByType('form').props.onChange());
    expect(renderer.root.findByType('signature-pad').props.value).toBeNull();
    await act(async () => sign());
    postReferral.mockRejectedValueOnce(new Error('offline'));
    await act(async () => print());
    expect(popup.print).not.toHaveBeenCalled();
    expect(popup.close).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    postReferral.mockResolvedValueOnce({ signature, signer_name: 'Clinician', signer_id: 1, signed_at: '2026-10-20' });
    await act(async () => print());
    expect(postReferral).toHaveBeenLastCalledWith(expect.objectContaining({ signature }), 1);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ signerName: 'Clinician', signature }));
    expect(popup.print).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore(); delete global.window;
  }
});
