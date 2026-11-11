const React = require('react');
let currentRole = 'admin';
beforeEach(() => { currentRole = 'admin'; });
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
// Radix Select needs a browser DOM; a native select stands in for it.
jest.mock('../src/components/ui/select', () => {
  const React = require('react');
  return {
    Select: ({ value, onValueChange, disabled, children }) => React.createElement('select', { 'aria-label': "Doctor's name", value, disabled, onChange: e => onValueChange(e.target.value) }, children),
    SelectTrigger: () => null, SelectValue: () => null,
    SelectContent: ({ children }) => React.createElement(React.Fragment, null, children),
    SelectItem: ({ value, children }) => React.createElement('option', { value }, children),
  };
});
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { id: 1, username: 'Clinician', role: currentRole } }) }));
jest.mock('../src/lib/api/visit/deleteReferral', () => ({ deleteReferral: jest.fn() }));
jest.mock('../src/lib/api/visit/postReferral', () => ({ postReferral: jest.fn() }));
jest.mock('../src/components/doctors-consultation/SignaturePad', () => ({ __esModule: true, default: props => React.createElement('signature-pad', props) }));
jest.mock('../src/components/doctors-consultation/ReferralDocument', () => ({ referralDocumentHtml: () => '<html>Referral</html>' }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const { postReferral } = require('../src/lib/api/visit/postReferral');
const toast = require('react-hot-toast').default;
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
    const doctor = () => renderer.root.findByProps({ 'aria-label': "Doctor's name" });
    expect(doctor().findAllByType('option').map(o => o.props.value)).toEqual(['Dr Lim Huai Yang', 'Dr Nadia Wong', 'Dr Ellie Choi', 'Dr Rayal Dy']);
    await act(async () => print());
    expect(window.open).not.toHaveBeenCalled(); // No doctor chosen and unsigned: printing is blocked.
    expect(toast.error).toHaveBeenLastCalledWith("Choose the doctor's name before printing.");
    await act(async () => doctor().props.onChange({ target: { value: 'Dr Ellie Choi' } }));
    await act(async () => print());
    expect(window.open).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenLastCalledWith('Please sign this referral before printing.');
    await act(async () => sign());
    await act(async () => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Updated reason' } }));
    expect(renderer.root.findByType('signature-pad').props.value).toEqual(signature);
    await act(async () => sign());
    postReferral.mockRejectedValueOnce(new Error("Couldn't reach the host laptop, so this may not have been saved."));
    await act(async () => print());
    expect(toast.error).toHaveBeenLastCalledWith("Couldn't reach the host laptop, so this may not have been saved.");
    expect(popup.print).not.toHaveBeenCalled();
    expect(popup.close).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    postReferral.mockResolvedValueOnce({ signature, signer_name: 'Clinician', signer_id: 1, signed_at: '2026-10-20' });
    await act(async () => print());
    expect(postReferral).toHaveBeenLastCalledWith(expect.objectContaining({ signature, doctorName: 'Dr Ellie Choi' }), 1);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ signerName: 'Clinician', doctorName: 'Dr Ellie Choi', signature }));
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

test('a user can change a saved referral but not print or delete it', async () => {
  currentRole = 'user';
  const { postReferral } = require('../src/lib/api/visit/postReferral');
  postReferral.mockReset();
  postReferral.mockResolvedValue({ signature: [[[0,0],[1,1]]], signer_name: 'Clinician', signer_id: 1, signed_at: '2026-10-22T01:00:00Z' });
  const previousWindow = global.window;
  global.window = { open: jest.fn() };
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const onSaved = jest.fn();
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(ReferralForm, {
      patient: { visit_id: 1 }, patientInfo: { english_name: 'Patient', date_of_birth: '2000-01-01' },
      retrievedReferral: { referralDate: '2026-10-22', referralType: [], illness: '', duration: '', reason: 'Saved', signature: [[[0,0],[1,1]]] },
      onClose: jest.fn(), onSaved,
    })); });
    expect(renderer.root.findAllByType('fieldset')[0].props.disabled).toBe(false);
    const labels = renderer.root.findAllByType('button').map(node => node.children.join(''));
    expect(labels).toContain('Save referral');
    for (const adminOnly of ['Delete referral', 'Save & print referral', 'Print saved referral']) expect(labels).not.toContain(adminOnly);
    const reason = renderer.root.findAllByType('textarea')[0];
    await act(async () => reason.props.onChange({ target: { value: 'Seen again at Dental' } }));
    await act(async () => renderer.root.findAllByType('button').find(node => node.children.join('') === 'Save referral').props.onClick());
    expect(postReferral.mock.calls[0][0]).toMatchObject({ reason: 'Seen again at Dental' });
    expect(onSaved).toHaveBeenCalled();
    expect(global.window.open).not.toHaveBeenCalled();
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    global.window = previousWindow; log.mockRestore();
  }
});

describe('saving a signature for this session', () => {
  const { useSavedSignatureStore } = require('../src/stores/useSavedSignatureStore');
  const signature = [[[0, 0], [1, 1]]];
  afterEach(() => useSavedSignatureStore.getState().forget());
  const render = async (retrievedReferral = null) => {
    let renderer;
    await act(async () => { renderer = create(React.createElement(ReferralForm, {
      patient: { visit_id: 1 }, patientInfo: { date_of_birth: '2000-01-01' }, retrievedReferral, onClose: jest.fn(),
    })); });
    return renderer;
  };
  const pad = renderer => renderer.root.findByType('signature-pad');

  test('a saved signature fills in on this user\'s next new referral, not on a saved one or another user\'s', async () => {
    const first = await render();
    expect(pad(first).props.value).toBeNull();
    await act(async () => pad(first).props.onChange(signature));
    expect(pad(first).props.saved).toBe(false);
    await act(async () => pad(first).props.onSave(signature));
    expect(pad(first).props.saved).toBe(true);
    expect(useSavedSignatureStore.getState()).toMatchObject({ userId: 1, signature });
    await act(async () => first.unmount());

    const next = await render();
    expect(pad(next).props.value).toEqual(signature);
    // Changing it here doesn't change what is saved.
    await act(async () => pad(next).props.onChange(null));
    expect(pad(next).props.saved).toBe(false);
    await act(async () => next.unmount());

    const existing = await render({ referralDate: '2026-01-01', referralType: [], illness: '', duration: '', reason: '', signature: null });
    expect(pad(existing).props.value).toBeNull();
    await act(async () => existing.unmount());

    useSavedSignatureStore.getState().save(2, signature);
    const otherUser = await render();
    expect(pad(otherUser).props.value).toBeNull();
    await act(async () => otherUser.unmount());
  });

  test('"Stop using it" forgets the saved signature', async () => {
    useSavedSignatureStore.getState().save(1, signature);
    const renderer = await render();
    await act(async () => pad(renderer).props.onForget());
    expect(useSavedSignatureStore.getState().signature).toBeNull();
    await act(async () => renderer.unmount());
  });
});
