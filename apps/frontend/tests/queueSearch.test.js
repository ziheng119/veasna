const React = require('react');
const { act, create } = require('react-test-renderer');
const push = jest.fn();
const replace = jest.fn();
let pathname = '/triage';
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), usePathname: () => pathname }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 'test' } }) }));
const QUEUE = [
  { visit_id: 1, patient_id: 11, queue_no: '12', english_name: 'Alice', current_station: 'triage', family: null },
  { visit_id: 2, patient_id: 12, queue_no: '3', english_name: 'Bona', current_station: 'seva' },
  { visit_id: 3, patient_id: 13, queue_no: '7', english_name: 'Chan', current_station: null },
  { visit_id: 4, patient_id: 14, queue_no: '30', english_name: 'Dara', current_station: 'dental', family: 'B' },
  { visit_id: 5, patient_id: 15, queue_no: '31', english_name: 'Sophea', current_station: 'triage', family: 'B' },
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
  // The search is in the top bar; the page open (pathname) says which station is "here".
  async function openSearch() {
    await act(async () => { renderer = create(React.createElement(SearchBar)); });
    await act(async () => button("Search everyone in today's clinic").props.onClick());
  }
  beforeEach(() => { pathname = '/triage'; push.mockClear(); replace.mockClear(); log = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); log.mockRestore(); });

  test('opening the search lists the next patients by queue number', async () => {
    await openSearch();
    expect(options()).toHaveLength(6);
    expect(optionText(options()[0])).toContain('Bona'); // queue 3 comes first
  });

  test('on their station\'s page, a patient opens in place, then the search collapses', async () => {
    await openSearch();
    await act(async () => input().props.onChange({ target: { value: '12' } }));
    expect(optionText(options()[0])).toContain('Here');
    await act(async () => options()[0].findByType('button').props.onClick());
    expect(replace).toHaveBeenCalledWith('/triage?visit=1', { scroll: false });
    expect(push).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
    await act(async () => button("Search everyone in today's clinic").props.onClick());
    expect(input().props.value).toBe('');
  });

  test('a patient elsewhere opens on their station page; Enter picks the top match', async () => {
    await openSearch();
    await act(async () => input().props.onChange({ target: { value: 'bon' } }));
    expect(options()).toHaveLength(1);
    await act(async () => input().props.onKeyDown({ key: 'Enter', preventDefault() {} }));
    expect(push).toHaveBeenCalledWith('/seva?visit=2');
    expect(replace).not.toHaveBeenCalled();
  });

  test('on a page that is not a station, every patient opens on their station page', async () => {
    pathname = '/patient-list';
    await openSearch();
    await act(async () => input().props.onChange({ target: { value: '12' } }));
    expect(optionText(options()[0])).not.toContain('Here');
    await act(async () => options()[0].findByType('button').props.onClick());
    expect(push).toHaveBeenCalledWith('/triage?visit=1');
  });

  test('it closes once another page has opened', async () => {
    await openSearch();
    await act(async () => input().props.onChange({ target: { value: 'bon' } }));
    pathname = '/seva';
    await act(async () => renderer.update(React.createElement(SearchBar)));
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
  });

  test('a patient with every station done opens their record', async () => {
    await openSearch();
    await act(async () => input().props.onChange({ target: { value: '7' } }));
    await act(async () => options()[0].findByType('button').props.onClick());
    expect(push).toHaveBeenCalledWith('/patient-details?id=13');
  });

  test('a family letter lists that family first, with its size', async () => {
    await openSearch();
    await act(async () => input().props.onChange({ target: { value: 'family b' } }));
    expect(options().map(o => optionText(o).split(' ')[1])).toEqual(['Dara', 'Sophea']);
    expect(renderer.root.findAll(n => n.type === 'span' && n.children.join('') === 'Family B (2 people)')).toHaveLength(1);
    await act(async () => input().props.onChange({ target: { value: 'b' } }));
    expect(options().map(o => optionText(o).split(' ')[1])).toEqual(['Dara', 'Sophea', 'Bona']);
  });

  test('finding one family member lists the rest of their family beside them', async () => {
    await openSearch();
    await act(async () => input().props.onChange({ target: { value: 'sophea' } }));
    expect(options().map(o => optionText(o).split(' ')[1])).toEqual(['Sophea', 'Dara']);
  });

  test('Escape and the close button collapse the search', async () => {
    await openSearch();
    await act(async () => input().props.onKeyDown({ key: 'Escape', preventDefault() {} }));
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
    await act(async () => button("Search everyone in today's clinic").props.onClick());
    await act(async () => button('Close clinic search').props.onClick());
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
  });
});
