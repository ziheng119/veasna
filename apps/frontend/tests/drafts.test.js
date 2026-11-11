// Unsaved typing kept as a draft in this browser (lib/drafts.ts, useLiveRecord's `draft` option in
// components/shared/LiveRecord.tsx): it survives a dropped connection, a sign-out or a reload.
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
const { useLiveRecord, LiveRecordNotice } = require('../src/components/shared/LiveRecord');
const { useUserStore } = require('../src/stores/useUserStore');
const { draftKey, readDraft, DRAFT_MAX_AGE_MS } = require('../src/lib/drafts');
global.IS_REACT_ACT_ENVIRONMENT = true;

// A simple in-memory localStorage, as in a browser.
function memoryStorage() {
  const items = new Map();
  return {
    get length() { return items.size; },
    key: index => Array.from(items.keys())[index] ?? null,
    getItem: key => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: key => items.delete(key),
  };
}

const text = node => (node.children ?? []).flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
// The record saved on the host.
let record, setNotes, save;
function Form() {
  const [notes, set] = React.useState('');
  const [version, setVersion] = React.useState(null);
  setNotes = set;
  React.useEffect(() => { set(record.notes); setVersion(1); }, []); // loads the saved record
  save = () => { record = { notes }; setVersion(v => v + 1); };
  const live = useLiveRecord({
    visitId: 7, savedVersion: version === null ? null : `v${version}`, values: { notes }, load: async () => record,
    valuesOf: data => ({ notes: data.notes }), apply: data => set(data.notes),
    draft: { form: 'dental', restore: draft => set(draft.notes) },
  });
  return React.createElement('div', null, React.createElement('p', { id: 'notes' }, notes), React.createElement(LiveRecordNotice, { live }));
}

let renderer, log;
const open = async () => { await act(async () => { renderer = create(React.createElement(Form)); }); };
const close = async () => { await act(async () => renderer.unmount()); renderer = null; };
const notes = () => text(renderer.root.findByProps({ id: 'notes' }));
const shown = () => text(renderer.root);
const button = label => renderer.root.findAllByType('button').find(node => text(node) === label);
const KEY = draftKey(1, 7, 'dental');

beforeEach(() => {
  global.localStorage = memoryStorage();
  log = jest.spyOn(console, 'error').mockImplementation(() => {});
  useUserStore.setState({ user: { id: 1, username: 'Dentist', role: 'user', token: 't' } });
  record = { notes: 'Saved notes' };
});
afterEach(async () => { if (renderer) await close(); delete global.localStorage; log.mockRestore(); });

test('typing is kept; reopening the form puts it back, with a note; Discard returns to the saved notes', async () => {
  await open();
  expect(readDraft(KEY)).toBeNull();
  await act(async () => setNotes('Extracted lower molar'));
  expect(JSON.parse(readDraft(KEY).values)).toEqual({ notes: 'Extracted lower molar' });
  await close(); // e.g. signed out, or the page reloaded
  await open();
  expect(notes()).toBe('Extracted lower molar');
  expect(shown()).toContain("Put back what you typed earlier on this device. It isn't saved yet.");
  await act(async () => button('Discard').props.onClick());
  expect(notes()).toBe('Saved notes');
  expect(readDraft(KEY)).toBeNull();
  expect(shown()).not.toContain('Put back');
});

test('saving removes the draft and the note', async () => {
  await open();
  await act(async () => setNotes('Cleaned teeth'));
  await close();
  await open();
  expect(shown()).toContain('Put back what you typed');
  await act(async () => save());
  expect(readDraft(KEY)).toBeNull();
  expect(shown()).not.toContain('Put back');
  await close();
  await open();
  expect(notes()).toBe('Cleaned teeth');
  expect(shown()).not.toContain('Put back');
});

test('saved on another device since: what was typed is offered, not put back over it', async () => {
  await open();
  await act(async () => setNotes('My notes'));
  await close();
  record = { notes: 'Notes from the other dentist' };
  await open();
  expect(notes()).toBe('Notes from the other dentist');
  expect(shown()).toContain('this was saved on another device since');
  // Further typing doesn't overwrite the waiting draft.
  await act(async () => setNotes('Notes from the other dentist, and more'));
  expect(JSON.parse(readDraft(KEY).values)).toEqual({ notes: 'My notes' });
  await act(async () => button('Put mine back').props.onClick());
  expect(notes()).toBe('My notes');
  expect(JSON.parse(readDraft(KEY).values)).toEqual({ notes: 'My notes' });

  // Or discarded.
  await close();
  await open();
  await act(async () => button('Discard').props.onClick());
  expect(notes()).toBe('Notes from the other dentist');
  expect(readDraft(KEY)).toBeNull();
});

test("drafts belong to the account that typed them, and are dropped after a day", async () => {
  await open();
  await act(async () => setNotes('Typed by account 1'));
  await close();
  useUserStore.setState({ user: { id: 2, username: 'Other', role: 'user', token: 't2' } });
  await open();
  expect(notes()).toBe('Saved notes');
  await close();

  useUserStore.setState({ user: { id: 1, username: 'Dentist', role: 'user', token: 't' } });
  const stored = JSON.parse(global.localStorage.getItem(KEY));
  global.localStorage.setItem(KEY, JSON.stringify({ ...stored, savedAt: Date.now() - DRAFT_MAX_AGE_MS - 1 }));
  await open();
  expect(notes()).toBe('Saved notes');
  expect(global.localStorage.getItem(KEY)).toBeNull();
});

test('without browser storage the form still works', async () => {
  global.localStorage = { get length() { throw new Error('blocked'); }, key() { throw new Error('blocked'); },
    getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  await open();
  await act(async () => setNotes('Still typing'));
  expect(notes()).toBe('Still typing');
});
