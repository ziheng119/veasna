const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
jest.mock('../src/components/ui/dialog', () => {
  const { createElement } = require('react');
  const part = name => ({ children }) => createElement('div', { 'data-dialog': name }, children);
  return {
    Dialog: ({ open, children }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    DialogContent: part('content'), DialogHeader: part('header'), DialogFooter: part('footer'),
    DialogTitle: part('title'), DialogDescription: part('description'),
  };
});
const Editor = require('../src/components/shared/StationRouteEditor').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('Station route controls', () => {
  let renderer, route, errorLog;
  function View({ initial, completed = [], disabled = false }) {
    const [value, setValue] = React.useState(initial); route = value;
    return React.createElement(Editor, { route: value, onChange: setValue, completed, disabled });
  }
  beforeEach(() => { errorLog = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); errorLog.mockRestore(); });
  const control = label => renderer.root.findAllByType('button').find(b => b.props['aria-label'] === label || b.children.join('') === label);
  async function mount(props) { await act(async () => { renderer = create(React.createElement(View, props)); }); }
  // Stops are reordered by dragging their grip, or with the arrow keys on it.
  const key = (label, key) => act(async () => control(`Drag to move ${label}`).props.onKeyDown({ key, preventDefault() {} }));
  // Removing a stop asks first in the custom pop-up; confirm it.
  async function removeStop(label) {
    let pending;
    await act(async () => { pending = control(`Remove ${label}`).props.onClick(); });
    const dialog = renderer.root.find(node => node.props.role === 'dialog');
    await act(async () => { dialog.findAllByType('button').find(b => b.children.join('') === 'Remove stop').props.onClick(); await pending; });
  }
  test('return sends a completed station to the front; skip keeps it for later', async () => {
    await mount({ initial: ['seva', 'consultation'], completed: ['triage'] });
    await act(async () => control('Return to Triage').props.onClick());
    expect(route).toEqual(['triage', 'seva', 'consultation']);
    await act(async () => control('Move Triage to the end').props.onClick());
    expect(route).toEqual(['seva', 'consultation', 'triage']);
    await key('Triage', 'ArrowUp');
    expect(route).toEqual(['seva', 'triage', 'consultation']);
    await key('Partner NGO', 'ArrowDown');
    expect(route).toEqual(['triage', 'seva', 'consultation']);
  });
  test('returning to a completed station makes it the next stop; removing differs from deferring', async () => {
    await mount({ initial: ['seva', 'consultation'], completed: ['triage'] });
    await act(async () => control('Return to Triage').props.onClick());
    expect(route[0]).toBe('triage');
    await removeStop('Partner NGO');
    expect(route).toEqual(['triage', 'consultation']);
  });
  test('removing the last stop explains what to do next', async () => {
    await mount({ initial: ['seva'] });
    let pending;
    await act(async () => { pending = control('Remove Partner NGO').props.onClick(); });
    expect(route).toEqual(['seva']); // not until confirmed
    const cancel = renderer.root.find(node => node.props.role === 'dialog').findAllByType('button').find(b => b.children.join('') === 'Cancel');
    await act(async () => { cancel.props.onClick(); await pending; });
    expect(route).toEqual(['seva']);
    await removeStop('Partner NGO');
    expect(route).toEqual([]);
    const text = renderer.root.findAllByType('p').map(p => p.children.join('')).join(' ');
    expect(text).toContain('discharge the patient instead');
  });
  test('all controls are disabled while saving', async () => {
    await mount({ initial: ['seva', 'consultation'], completed: ['triage'], disabled: true });
    expect(renderer.root.findAllByType('button').every(b => b.props.disabled)).toBe(true);
  });
});
