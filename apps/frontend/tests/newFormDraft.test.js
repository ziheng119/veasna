// Registration's unsaved typing kept as a draft on this device (hooks/useNewFormDraft.ts).
const React = require('react');
const { act, create } = require('react-test-renderer');
const { useNewFormDraft } = require('../src/hooks/useNewFormDraft');
const { newRecordDraftKey, readDraft, writeDraft } = require('../src/lib/drafts');
global.IS_REACT_ACT_ENVIRONMENT = true;

const items = new Map();
global.localStorage = {
  get length() { return items.size; },
  key: index => Array.from(items.keys())[index] ?? null,
  getItem: key => (items.has(key) ? items.get(key) : null),
  setItem: (key, value) => items.set(key, String(value)),
  removeItem: key => items.delete(key),
};

const EMPTY = { name: '', requestId: 'r1' };
const KEY = newRecordDraftKey(7, 'registration');
let form, setForm;
function Form({ draftKey }) {
  const [values, set] = React.useState(EMPTY);
  setForm = set;
  form = useNewFormDraft(draftKey, values, EMPTY, set);
  return null;
}
let values = () => null;
const render = (draftKey = KEY) => {
  let renderer;
  act(() => { renderer = create(React.createElement(Form, { draftKey })); });
  values = () => JSON.parse(readDraft(KEY)?.values ?? 'null');
  return renderer;
};

beforeEach(() => items.clear());

test('typing is kept, and goes once the form is emptied (registered)', () => {
  render();
  expect(values()).toBeNull();
  act(() => setForm({ name: 'Sokha', requestId: 'r1' }));
  expect(values()).toEqual({ name: 'Sokha', requestId: 'r1' });
  act(() => setForm(EMPTY));
  expect(values()).toBeNull();
});

test('reopening the form puts the draft back, with its request id, and a note with Discard', () => {
  writeDraft(KEY, { values: JSON.stringify({ name: 'Sokha', requestId: 'r0' }), base: '', savedAt: Date.now() });
  render();
  expect(form.notice).toBe('restored');
  expect(values()).toEqual({ name: 'Sokha', requestId: 'r0' });

  act(() => form.discardDraft());
  expect(form.notice).toBeNull();
  expect(values()).toBeNull();
});

test('nothing is read or written until the account is known, and each account has its own', () => {
  writeDraft(KEY, { values: JSON.stringify({ name: 'Sokha', requestId: 'r0' }), base: '', savedAt: Date.now() });
  render(null);
  act(() => setForm({ name: 'Dara', requestId: 'r1' }));
  expect(values()).toEqual({ name: 'Sokha', requestId: 'r0' });

  items.clear();
  render(newRecordDraftKey(8, 'registration'));
  act(() => setForm({ name: 'Dara', requestId: 'r1' }));
  expect(values()).toBeNull();
  expect(readDraft(newRecordDraftKey(8, 'registration'))).not.toBeNull();
});
