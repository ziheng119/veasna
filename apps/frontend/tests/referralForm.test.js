const React = require('react');
const { act, create } = require('react-test-renderer');
// Keep portal mechanics out of renderer tests while exercising controlled dialog state.
jest.mock('../src/components/ui/dialog', () => {
  const React = require('react');
  const Context = React.createContext(null);
  return {
    Dialog: ({ children, ...state }) => React.createElement(Context.Provider, { value: state }, children),
    DialogTrigger: ({ children }) => {
      const state = React.useContext(Context);
      return React.cloneElement(children, { onClick: () => state.onOpenChange(true) });
    },
    DialogContent: ({ children, ...props }) => React.useContext(Context).open ? React.createElement('section', { ...props, role: 'dialog' }, children) : null,
    DialogHeader: ({ children }) => React.createElement('header', null, children),
    DialogFooter: ({ children }) => React.createElement('footer', null, children),
    DialogTitle: ({ children }) => React.createElement('h2', null, children),
    DialogDescription: ({ children }) => React.createElement('p', null, children),
  };
});
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { id: 1, username: 'Clinician' } }) }));
jest.mock('../src/lib/api/visit/deleteReferral', () => ({ deleteReferral: jest.fn() }));
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

test('editing retains signature; print saves first, uses saved record, and save failures do not print', async () => {
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
    await act(async () => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Updated reason' } }));
    expect(renderer.root.findByType('signature-pad').props.value).toEqual(signature);
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

test('deletion needs confirmation, keeps editor on failure, and closes only after success', async () => {
  const { deleteReferral } = require('../src/lib/api/visit/deleteReferral');
  deleteReferral.mockReset();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const onDeleted = jest.fn(), onClose = jest.fn();
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(ReferralForm, {
      patient: { visit_id: 7 }, patientInfo: { english_name: 'Patient', date_of_birth: '2000-01-01' },
      retrievedReferral: { referralDate: '2026-10-20', referralType: [], illness: '', duration: '', reason: '' }, onDeleted, onClose,
    })); });
    const remove = () => renderer.root.findAllByType('button').find(n => n.children.join('') === 'Delete referral').props.onClick();
    await act(async () => remove());
    expect(deleteReferral).not.toHaveBeenCalled();
    const action = label => renderer.root.findAllByType('button').find(n => n.children.join('') === label);
    expect(action('Confirm deletion')).toBeDefined();
    await act(async () => action('Cancel').props.onClick());
    expect(action('Confirm deletion')).toBeUndefined();
    expect(deleteReferral).not.toHaveBeenCalled();
    await act(async () => remove());
    deleteReferral.mockRejectedValueOnce(new Error('offline'));
    await act(async () => action('Confirm deletion').props.onClick());
    expect(onDeleted).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ role: 'alert' }).children.join('')).toContain('Unable to delete');
    deleteReferral.mockResolvedValueOnce(undefined);
    await act(async () => action('Confirm deletion').props.onClick());
    expect(deleteReferral).toHaveBeenLastCalledWith(7);
    expect(onDeleted).toHaveBeenCalledTimes(1); expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    delete global.window; log.mockRestore();
  }
});

test('saved signature reloads into the editable pad and explicit clearing is saved', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const signature = [[[0, 0], [1, 1]]];
  const edited = [...signature, [[0.2, 0.3], [0.4, 0.5]]];
  let renderer;
  const props = { patient: { visit_id: 1 }, patientInfo: { date_of_birth: '2000-01-01' },
    retrievedReferral: { referralDate: '2026-10-21', referralType: [], illness: '', duration: '', reason: '', signature }, onClose: jest.fn() };
  try {
    await act(async () => { renderer = create(React.createElement(ReferralForm, props)); });
    const pad = () => renderer.root.findByType('signature-pad');
    expect(pad().props.value).toEqual(signature);
    await act(async () => pad().props.onChange(edited));
    postReferral.mockResolvedValueOnce({ signature: edited });
    const save = () => renderer.root.findAllByType('button').find(n => n.children.join('') === 'Save referral').props.onClick();
    await act(async () => save());
    expect(postReferral).toHaveBeenLastCalledWith(expect.objectContaining({ signature: edited }), 1);
    await act(async () => renderer.unmount());
    await act(async () => { renderer = create(React.createElement(ReferralForm, { ...props, retrievedReferral: { ...props.retrievedReferral, signature: edited } })); });
    expect(pad().props.value).toEqual(edited);
    await act(async () => pad().props.onChange(null));
    postReferral.mockResolvedValueOnce({ signature: null });
    await act(async () => save());
    expect(postReferral).toHaveBeenLastCalledWith(expect.objectContaining({ signature: null }), 1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});
