const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 'test' } }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/hooks/useLiveList', () => ({
  useLiveList: () => ({ data: [{ visit_id: 1, queue_no: '12', english_name: 'Alice' }] }),
}));
const SearchBar = require('../src/components/shared/SearchBar').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test('queue lookup opens, selects a patient, and collapses without clearing selection', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const onSelectPatient = jest.fn();
  let renderer;
  const button = label => renderer.root.findAllByType('button').find(n => n.props['aria-label'] === label);
  try {
    await act(async () => { renderer = create(React.createElement(SearchBar, { onSelectPatient })); });
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
    await act(async () => button("Search today's queue").props.onClick());
    expect(button("Search today's queue").props['aria-expanded']).toBe(true);
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: '12' } }));
    await act(async () => renderer.root.findByType('li').findByType('button').props.onClick());
    expect(onSelectPatient).toHaveBeenCalledWith(expect.objectContaining({ visit_id: 1 }));
    await act(async () => renderer.root.findByType('input').props.onKeyDown({ key: 'Escape', preventDefault() {} }));
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
    expect(onSelectPatient).toHaveBeenCalledTimes(1);
    await act(async () => button("Search today's queue").props.onClick());
    expect(renderer.root.findByType('input').props.value).toBe('');
    await act(async () => button('Close queue search').props.onClick());
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});
