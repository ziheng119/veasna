// Saves made for the same visit on another device show in an open form (useLiveRecord and
// LiveRecordNotice in components/shared/LiveRecord.tsx, fed by stores/useRealtimeStore.ts).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
const { useLiveRecord, LiveRecordNotice } = require('../src/components/shared/LiveRecord');
const { useRealtimeStore } = require('../src/stores/useRealtimeStore');
global.IS_REACT_ACT_ENVIRONMENT = true;

const text = node => (node.children ?? []).flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
// The record on the server, and what else the form keeps from it.
let record, shared, load, setNotes;
function Form({ visitId }) {
  const [notes, set] = React.useState('Saved notes');
  const [version, setVersion] = React.useState(1);
  setNotes = set;
  const live = useLiveRecord({
    visitId, savedVersion: `v${version}`, values: { notes }, load,
    valuesOf: data => ({ notes: data.notes }),
    apply: data => { set(data.notes); setVersion(v => v + 1); },
    applyShared: data => { shared = data.referral; },
  });
  return React.createElement('div', null, React.createElement('p', { id: 'notes' }, notes), React.createElement(LiveRecordNotice, { live }));
}

let renderer;
const mount = async () => { await act(async () => { renderer = create(React.createElement(Form, { visitId: 1 })); }); };
const changed = async ids => { await act(async () => { useRealtimeStore.getState().noteVisitChanges(ids); }); };
const notes = () => text(renderer.root.findByProps({ id: 'notes' }));
const shown = () => text(renderer.root);
const button = label => renderer.root.findAllByType('button').find(node => text(node) === label);

beforeEach(() => {
  record = { notes: 'Saved notes', referral: null }; shared = undefined;
  load = jest.fn(async () => record);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; jest.useRealTimers(); });

test('nothing typed here: a save on another device is shown, with a short note that goes away', async () => {
  jest.useFakeTimers();
  await mount();
  record = { notes: 'Notes from the other doctor', referral: { reason: 'Glasses' } };
  await changed([1]);
  expect(notes()).toBe('Notes from the other doctor');
  expect(shown()).toContain('Updated with a save from another device.');
  expect(shared).toEqual({ reason: 'Glasses' });
  await act(async () => { jest.advanceTimersByTime(6000); });
  expect(shown()).not.toContain('Updated');
});

test('typed here: what was typed stays, and the saved version is offered', async () => {
  await mount();
  await act(async () => setNotes('My own notes'));
  record = { notes: 'Their notes', referral: null };
  await changed([1]);
  expect(notes()).toBe('My own notes');
  expect(shown()).toContain('Saved on another device while you were typing.');
  await act(async () => button('Show saved version').props.onClick());
  expect(notes()).toBe('Their notes');
  expect(shown()).not.toContain('while you were typing');
});

test('Keep mine keeps what was typed', async () => {
  await mount();
  await act(async () => setNotes('My own notes'));
  record = { notes: 'Their notes', referral: null };
  await changed([1]);
  await act(async () => button('Keep mine').props.onClick());
  expect(notes()).toBe('My own notes');
  expect(shown()).not.toContain('another device');
});

test("this form's own save, or a save for another visit, shows nothing", async () => {
  await mount();
  await changed([1]); // e.g. this form was just saved: the record matches it
  expect(load).toHaveBeenCalledTimes(1);
  expect(shown()).not.toContain('another device');
  await changed([2]);
  expect(load).toHaveBeenCalledTimes(1);
  // A save that names no visit (or a reconnect) may concern any visit, so the form checks.
  await changed(null);
  expect(load).toHaveBeenCalledTimes(2);
});

test('typing the same thing that was saved elsewhere is simply shown as saved', async () => {
  await mount();
  await act(async () => setNotes('Same words'));
  record = { notes: 'Same words', referral: null };
  await changed([1]);
  expect(shown()).not.toContain('another device');
  expect(notes()).toBe('Same words');
});

test('the notice names the section when a page has several', async () => {
  const live = { notice: 'conflict', seq: 1, showSaved: jest.fn(), keepMine: jest.fn() };
  await act(async () => { renderer = create(React.createElement(LiveRecordNotice, { live, label: 'Visual Acuity' })); });
  expect(text(renderer.root)).toContain('Visual Acuity: saved on another device while you were typing.');
});
