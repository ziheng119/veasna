const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
const Editor = require('../src/components/shared/StationRouteEditor').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('Station route controls', () => {
  let renderer, route, errorLog;
  function View({ initial, completed = [], held = false, disabled = false }) {
    const [value, setValue] = React.useState(initial); route = value;
    return React.createElement(Editor, { route: value, onChange: setValue, completed, onTbHold: held, disabled });
  }
  beforeEach(() => { errorLog = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); errorLog.mockRestore(); });
  const control = label => renderer.root.findAllByType('button').find(b => b.props['aria-label'] === label || b.children.join('') === label);
  async function mount(props) { await act(async () => { renderer = create(React.createElement(View, props)); }); }
  test('return sends a completed station to the front; skip keeps it for later', async () => {
    await mount({ initial: ['seva', 'consultation'], completed: ['triage'] });
    await act(async () => control('Return to Triage').props.onClick());
    expect(route).toEqual(['triage', 'seva', 'consultation']);
    await act(async () => control('Defer Triage').props.onClick());
    expect(route).toEqual(['seva', 'consultation', 'triage']);
    await act(async () => control('Move Triage earlier').props.onClick());
    expect(route).toEqual(['seva', 'triage', 'consultation']);
  });
  test('a TB hold cannot be removed, deferred or overtaken', async () => {
    await mount({ initial: ['tb', 'seva'], completed: ['triage'], held: true });
    for (const label of ['Remove TB Tent', 'Defer TB Tent', 'Move TB Tent later', 'Move Seva earlier']) {
      expect(control(label).props.disabled).toBe(true);
    }
    await act(async () => control('Return to Triage').props.onClick());
    expect(route).toEqual(['tb', 'triage', 'seva']);
  });
  test('reopening TB places it first; removing a stop differs from deferring it', async () => {
    await mount({ initial: ['seva', 'consultation'], completed: ['tb'] });
    await act(async () => control('Return to TB Tent').props.onClick());
    expect(route[0]).toBe('tb');
    await act(async () => control('Remove Seva').props.onClick());
    expect(route).toEqual(['tb', 'consultation']);
  });
  test('all controls are disabled while saving', async () => {
    await mount({ initial: ['seva', 'consultation'], completed: ['triage'], disabled: true });
    expect(renderer.root.findAllByType('button').every(b => b.props.disabled)).toBe(true);
  });
});
