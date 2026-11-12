// The Accounts page's pieces: choosing permissions (components/accounts/PermissionPicker.tsx), the
// date/password/permissions pop-up that replaces the browser's prompt
// (components/accounts/AccountEditDialog.tsx), and the account menu's descriptions
// (components/shared/AccountMenu.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/components/ui/button', () => ({ Button: props => require('react').createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => require('react').createElement('input', props) }));
jest.mock('../src/components/ui/dialog', () => {
  const { createElement } = require('react');
  const part = name => ({ children }) => createElement('div', { 'data-dialog': name }, children);
  return {
    Dialog: ({ open, children }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    DialogContent: part('content'), DialogHeader: part('header'), DialogFooter: part('footer'),
    DialogTitle: part('title'), DialogDescription: part('description'),
  };
});
const PermissionPicker = require('../src/components/accounts/PermissionPicker').default;
const AccountEditDialog = require('../src/components/accounts/AccountEditDialog').default;
const { useHostClockStore } = require('../src/stores/useHostClockStore');
global.IS_REACT_ACT_ENVIRONMENT = true;

const text = node => (node.children ?? []).flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
});

describe('PermissionPicker', () => {
  const mount = async (value, onChange = jest.fn()) => {
    await act(async () => { renderer = create(React.createElement(PermissionPicker, { id: 't', value, onChange })); });
    return onChange;
  };
  const toggle = label => renderer.root.findAll(n => n.type === 'button' && n.props.role === 'checkbox').find(n => text(n).includes(label));

  test('shows every permission as a toggle, ticked as given', async () => {
    await mount(['view_today', 'edit_today']);
    const toggles = renderer.root.findAll(n => n.type === 'button' && n.props.role === 'checkbox');
    expect(toggles).toHaveLength(7);
    expect(toggle("See today's patients").props['aria-checked']).toBe(true);
    expect(toggle('Analytics').props['aria-checked']).toBe(false);
  });

  test('ticking one that needs others ticks them too, and says so', async () => {
    const onChange = await mount([]);
    await act(async () => toggle('Edit past visits').props.onClick());
    expect(onChange).toHaveBeenCalledWith(['view_today', 'edit_today', 'view_past', 'edit_past']);
    expect(text(renderer.root)).toContain("Also ticked: See today's patients, Edit today's queue, See past patients.");
  });

  test('pointing at a toggle describes it; Defaults puts back the defaults', async () => {
    const onChange = await mount(['analytics']);
    await act(async () => toggle('Pharmacy stock').props.onPointerEnter());
    expect(text(renderer.root)).toContain('Add drugs, change stock counts, dispense and cancel prescriptions.');
    const defaults = renderer.root.findAll(n => n.type === 'button' && text(n).includes('Defaults'))[0];
    await act(async () => defaults.props.onClick());
    expect(onChange).toHaveBeenCalledWith(['view_today', 'edit_today']);
  });

  test('with nothing ticked it says the account can only view the queues', async () => {
    await mount([]);
    expect(text(renderer.root)).toContain('Nothing ticked: the account can only view the station queues.');
  });
});

describe('AccountEditDialog', () => {
  const account = { id: 4, username: 'dec13village', role: 'user', is_active: true, screening_date: '2026-12-13',
    permissions: ['view_today', 'edit_today'], created_at: '', last_updated_at: '' };
  const mount = async (edit, onSave = jest.fn().mockResolvedValue(undefined), onClose = jest.fn()) => {
    await act(async () => { renderer = create(React.createElement(AccountEditDialog, { open: true, account, edit, onSave, onClose })); });
    return { onSave, onClose };
  };
  const submit = () => act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  const saveButton = () => renderer.root.findAll(n => n.type === 'button' && n.props.type === 'submit')[0];
  beforeEach(() => useHostClockStore.setState({ offsetMs: 0, utcOffsetMinutes: null }));

  test('the password must be long enough before it can be saved; then it saves and closes', async () => {
    const { onSave, onClose } = await mount('password');
    const input = renderer.root.findByType('input');
    await act(async () => input.props.onChange({ target: { value: 'ab' } }));
    expect(saveButton().props.disabled).toBe(true);
    expect(text(renderer.root)).toContain('At least 4 characters (2 so far).');
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'ilovebtb' } }));
    expect(saveButton().props.disabled).toBe(false);
    await submit();
    expect(onSave).toHaveBeenCalledWith(account, { password: 'ilovebtb' });
    expect(onClose).toHaveBeenCalled();
  });

  test('an unchanged date cannot be saved; a past date warns; a refused save stays open with the reason', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Choose the screening date.'));
    const { onClose } = await mount('date', onSave);
    expect(saveButton().props.disabled).toBe(true);
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: '2020-01-01' } }));
    expect(text(renderer.root)).toContain("This day is over, so the account won't be able to sign in.");
    await submit();
    expect(onSave).toHaveBeenCalledWith(account, { screening_date: '2020-01-01' });
    expect(onClose).not.toHaveBeenCalled();
    expect(text(renderer.root.findByProps({ role: 'alert' }))).toBe('Choose the screening date.');
  });

  test('permissions start from the account and save the new choice', async () => {
    const { onSave } = await mount('permissions');
    const analytics = renderer.root.findAll(n => n.type === 'button' && n.props.role === 'checkbox').find(n => text(n).includes('Analytics'));
    await act(async () => analytics.props.onClick());
    await submit();
    expect(onSave).toHaveBeenCalledWith(account, { permissions: ['view_today', 'edit_today', 'analytics'] });
  });
});

describe('AccountMenu', () => {
  jest.mock('@radix-ui/react-dropdown-menu', () => {
    const { createElement } = require('react');
    const pass = type => ({ children, asChild: _asChild, onSelect, sideOffset: _s, avoidCollisions: _a, align: _al, side: _si, ...props }) =>
      createElement(type, { ...props, onClick: onSelect }, children);
    return { Root: ({ children }) => createElement('div', null, children), Trigger: ({ children }) => children,
      Portal: ({ children }) => children, Content: pass('div'), Item: pass('li') };
  });
  jest.mock('react-dom', () => ({ ...jest.requireActual('react-dom'), createPortal: node => node }));

  test('each option carries its description, read out too', async () => {
    const AccountMenu = require('../src/components/shared/AccountMenu').default;
    const onSelect = jest.fn();
    await act(async () => {
      renderer = create(React.createElement(AccountMenu, { username: 'admin', items: [
        { label: 'Accounts', description: 'Make an account for each screening day.', icon: () => null, onSelect },
      ] }));
    });
    const item = renderer.root.findByType('li');
    expect(text(item)).toContain('Accounts: Make an account for each screening day.');
    await act(async () => item.props.onClick());
    expect(onSelect).toHaveBeenCalled();
  });
});
