// Patient List: sorting by column (lib/patientSort.ts, PatientTable.tsx) and opening a queued patient
// at their station (PatientTableRow.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role: 'user' } }) }));
jest.mock('../src/assets/icons', () => ({ EyeIcon: () => null, TrashIcon: () => null, PersonIcon: () => null }));
jest.mock('../src/components/patient-list/FamilyButton', () => ({ __esModule: true, default: () => null }));
const { sortPatients, nextPatientSort, DEFAULT_PATIENT_SORT } = require('../src/lib/patientSort');
const { PatientTable } = require('../src/components/patient-list/PatientTable');
global.IS_REACT_ACT_ENVIRONMENT = true;

const person = (id, english_name, more = {}) => ({ id, english_name, date_of_birth: '2000-01-01', ...more });
const ids = list => list.map(p => p.id);

describe('sorting', () => {
  const list = [
    person(1, 'bob', { date_of_birth: '1990-05-01', phone_number: '012 9', current_station: 'dental', queue_visit_id: 11 }),
    person(2, 'Ann', { date_of_birth: '2010-01-01', phone_number: '', last_visit_date: '2026-11-01' }),
    person(3, 'Chan 10', { date_of_birth: '1980-01-01', phone_number: '012 10', current_station: 'triage', queue_visit_id: 12, last_visit_date: '2026-10-01' }),
    person(4, 'Chan 9', { date_of_birth: '2000-01-01' }),
  ];

  test('the default is English name A to Z, ignoring case and with numbers in order', () => {
    expect(DEFAULT_PATIENT_SORT).toEqual({ key: 'english_name', direction: 'asc' });
    expect(ids(sortPatients(list, DEFAULT_PATIENT_SORT))).toEqual([2, 1, 4, 3]);
  });

  test('a second click on the same column flips it; another column starts ascending', () => {
    const flipped = nextPatientSort(DEFAULT_PATIENT_SORT, 'english_name');
    expect(flipped).toEqual({ key: 'english_name', direction: 'desc' });
    expect(ids(sortPatients(list, flipped))).toEqual([3, 4, 1, 2]);
    expect(nextPatientSort(flipped, 'age')).toEqual({ key: 'age', direction: 'asc' });
  });

  test('dates, age and station sort by value; empty cells always come last', () => {
    expect(ids(sortPatients(list, { key: 'date_of_birth', direction: 'asc' }))).toEqual([3, 1, 4, 2]);
    // Youngest first.
    expect(ids(sortPatients(list, { key: 'age', direction: 'asc' }))).toEqual([2, 4, 1, 3]);
    expect(ids(sortPatients(list, { key: 'last_visit_date', direction: 'desc' }))).toEqual([2, 3, 1, 4]);
    // Clinic order: Triage before Dental; patients not in the queue last either way.
    expect(ids(sortPatients(list, { key: 'current_station', direction: 'asc' }))).toEqual([3, 1, 2, 4]);
    expect(ids(sortPatients(list, { key: 'current_station', direction: 'desc' }))).toEqual([1, 3, 2, 4]);
    expect(ids(sortPatients(list, { key: 'phone_number', direction: 'asc' }))).toEqual([1, 3, 2, 4]);
  });

  test('sorting does not change the list it was given', () => {
    const frozen = Object.freeze([...list]);
    sortPatients(frozen, { key: 'age', direction: 'desc' });
    expect(ids(frozen)).toEqual([1, 2, 3, 4]);
  });
});

describe('the table', () => {
  const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
  let renderer;
  afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; push.mockClear(); });
  const render = async patients => { await act(async () => { renderer = create(React.createElement(PatientTable, { patients })); }); };
  const names = () => renderer.root.findAllByType('tr').slice(1).map(row => text(row.findAllByType('td')[0]));
  const header = label => renderer.root.findAllByType('th').find(th => text(th) === label);

  test('clicking a header sorts by it, clicking again flips it, and only the sorted column is marked', async () => {
    await render([person(1, 'Bo', { sex: 'M' }), person(2, 'Ann', { sex: 'F' }), person(3, 'Cy', { sex: 'M' })]);
    expect(names()).toEqual(['Ann', 'Bo', 'Cy']);
    expect(header('English Name').props['aria-sort']).toBe('ascending');
    await act(async () => header('English Name').findByType('button').props.onClick());
    expect(names()).toEqual(['Cy', 'Bo', 'Ann']);
    expect(header('English Name').props['aria-sort']).toBe('descending');
    await act(async () => header('Sex').findByType('button').props.onClick());
    expect(names()).toEqual(['Ann', 'Bo', 'Cy']);
    expect(header('Sex').props['aria-sort']).toBe('ascending');
    expect(header('English Name').props['aria-sort']).toBeUndefined();
    expect(header('Sex').findByType('button').props.className).toMatch(/cursor-pointer/);
    // Actions can't be sorted.
    expect(header('Actions').findAllByType('button')).toHaveLength(0);
  });

  test('a queued patient shows their station and opens there; others show nothing and do nothing', async () => {
    await render([person(1, 'Ann', { queue_visit_id: 7, current_station: 'dental' }), person(2, 'Bo')]);
    const [ann, bo] = renderer.root.findAllByType('tr').slice(1);
    const stationCell = row => text(row.findAllByType('td')[9]);
    expect(stationCell(ann)).toBe('Dental');
    expect(stationCell(bo)).toBe('');
    const click = (row, target = {}) => row.props.onClick({ target: { closest: () => null, ...target }, currentTarget: { contains: () => true } });
    await act(async () => click(ann));
    expect(push).toHaveBeenCalledWith('/dental?visit=7');
    push.mockClear();
    await act(async () => click(bo));
    expect(push).not.toHaveBeenCalled();
    expect(bo.props.className).toMatch(/cursor-default/);
    expect(bo.props.tabIndex).toBeUndefined();
    // The row's own buttons don't open the station.
    await act(async () => click(ann, { closest: () => ({}) }));
    expect(push).not.toHaveBeenCalled();
  });
});
