const React = require('react');
const { act, create } = require('react-test-renderer');
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 'test' } }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
const QUEUE = [
  { visit_id: 1, patient_id: 11, queue_no: '12', english_name: 'Alice', current_station: 'triage' },
  { visit_id: 2, patient_id: 12, queue_no: '3', english_name: 'Bona', current_station: 'seva' },
  { visit_id: 3, patient_id: 13, queue_no: '7', english_name: 'Chan', current_station: null },
  ...Array.from({ length: 6 }, (_, i) => ({ visit_id: 10 + i, patient_id: 20 + i, queue_no: String(20 + i), english_name: `P${i}`, current_station: 'consultation' })),
];
jest.mock('../src/hooks/useLiveList', () => ({ useLiveList: () => ({ data: QUEUE }) }));
const SearchBar = require('../src/components/shared/SearchBar').default;
global.IS_REACT_ACT_ENVIRONMENT = true;
// No DOM in this environment; the outside-click listener only needs these.
global.document = { addEventListener() {}, removeEventListener() {} };

describe('Queue search', () => {
  let renderer, log;
  const button = label => renderer.root.findAllByType('button').find(n => n.props['aria-label'] === label);
  const options = () => renderer.root.findAll(n => n.props.role === 'option');
  const optionText = option => option.findAllByType('span').flatMap(s => s.children.filter(c => typeof c === 'string')).join(' ');
  const input = () => renderer.root.findByType('input');
  async function openSearch(props) {
    await act(async () => { renderer = create(React.createElement(SearchBar, props)); });
    await act(async () => button("Search today's queue").props.onClick());
  }
  beforeEach(() => { push.mockClear(); log = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); log.mockRestore(); });

  test('opening the search lists the next patients by queue number', async () => {
    await openSearch({ station: 'triage' });
    expect(options()).toHaveLength(6);
    expect(optionText(options()[0])).toContain('Bona'); // queue 3 comes first
  });

  test('a patient at this station opens in place, then the search collapses', async () => {
    const onSelectPatient = jest.fn();
    await openSearch({ station: 'triage', onSelectPatient });
    await act(async () => input().props.onChange({ target: { value: '12' } }));
    await act(async () => options()[0].findByType('button').props.onClick());
    expect(onSelectPatient).toHaveBeenCalledWith(expect.objectContaining({ visit_id: 1 }));
    expect(push).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
    await act(async () => button("Search today's queue").props.onClick());
    expect(input().props.value).toBe('');
  });

  test('a patient elsewhere opens on their station page; Enter picks the top match', async () => {
    const onSelectPatient = jest.fn();
    await openSearch({ station: 'triage', onSelectPatient });
    await act(async () => input().props.onChange({ target: { value: 'bon' } }));
    expect(options()).toHaveLength(1);
    await act(async () => input().props.onKeyDown({ key: 'Enter', preventDefault() {} }));
    expect(push).toHaveBeenCalledWith('/seva?visit=2');
    expect(onSelectPatient).not.toHaveBeenCalled();
  });

  test('a patient with every station done opens their record', async () => {
    await openSearch({ station: 'triage' });
    await act(async () => input().props.onChange({ target: { value: '7' } }));
    await act(async () => options()[0].findByType('button').props.onClick());
    expect(push).toHaveBeenCalledWith('/patient-details?id=13');
  });

  test('Escape and the close button collapse the search', async () => {
    await openSearch({ station: 'triage' });
    await act(async () => input().props.onKeyDown({ key: 'Escape', preventDefault() {} }));
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
    await act(async () => button("Search today's queue").props.onClick());
    await act(async () => button('Close queue search').props.onClick());
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
  });
});
