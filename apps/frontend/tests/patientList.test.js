// Patient List: sorting by column (lib/patientSort.ts, PatientTable.tsx) and opening a queued patient
// at their station (PatientTableRow.tsx), and the referral of a completed visit (ReferralAction.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role: 'user' } }) }));
jest.mock('../src/assets/icons', () => ({ EyeIcon: () => null, TrashIcon: () => null, PersonIcon: () => null }));
jest.mock('../src/components/patient-list/FamilyButton', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/shared/read-only/patient-container/referral/ReferralPopUp', () => ({ __esModule: true, default: () => null }));
const mockGetConsultation = jest.fn();
jest.mock('../src/lib/api/visit/doctors-consultation/getConsultation', () => ({ getConsultation: (...args) => mockGetConsultation(...args) }));
const { sortPatients, nextPatientSort, describeSort, DEFAULT_PATIENT_SORT } = require('../src/lib/patientSort');
const { PatientTable } = require('../src/components/patient-list/PatientTable');
const { ArrowDown, ArrowUp } = require('lucide-react');
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

  test('the default is Last Seen, most recent first; patients never seen come last', () => {
    expect(DEFAULT_PATIENT_SORT).toEqual({ key: 'last_visit_date', direction: 'desc' });
    expect(describeSort(DEFAULT_PATIENT_SORT)).toBe('most recent first');
    expect(ids(sortPatients(list, DEFAULT_PATIENT_SORT))).toEqual([2, 3, 1, 4]);
  });

  test('patients seen the same day: the most recently registered first', () => {
    const today = [
      person(1, 'Early', { last_visit_date: '2026-11-10', last_visit_at: '2026-11-10T01:00:00Z' }),
      person(2, 'Yesterday', { last_visit_date: '2026-11-09', last_visit_at: '2026-11-09T09:00:00Z' }),
      person(3, 'Late', { last_visit_date: '2026-11-10', last_visit_at: '2026-11-10T03:00:00Z' }),
    ];
    expect(ids(sortPatients(today, DEFAULT_PATIENT_SORT))).toEqual([3, 1, 2]);
    expect(ids(sortPatients(today, nextPatientSort(DEFAULT_PATIENT_SORT, 'last_visit_date')))).toEqual([2, 1, 3]);
  });

  test('names sort A to Z ignoring case, with numbers in order; a second click flips a column', () => {
    const byName = nextPatientSort(DEFAULT_PATIENT_SORT, 'english_name');
    expect(byName).toEqual({ key: 'english_name', direction: 'asc' });
    expect(describeSort(byName)).toBe('A to Z');
    expect(ids(sortPatients(list, byName))).toEqual([2, 1, 4, 3]);
    const flipped = nextPatientSort(byName, 'english_name');
    expect(flipped).toEqual({ key: 'english_name', direction: 'desc' });
    expect(ids(sortPatients(list, flipped))).toEqual([3, 4, 1, 2]);
    // Another column starts ascending, except Last Seen, which starts with the most recent.
    expect(nextPatientSort(flipped, 'age')).toEqual({ key: 'age', direction: 'asc' });
    expect(nextPatientSort(flipped, 'last_visit_date')).toEqual({ key: 'last_visit_date', direction: 'desc' });
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
    await render([person(1, 'Bo', { sex: 'M', last_visit_date: '2026-11-01' }), person(2, 'Ann', { sex: 'F', last_visit_date: '2026-10-01' }),
      person(3, 'Cy', { sex: 'M', last_visit_date: '2026-11-10' })]);
    // Opens sorted by Last Seen, most recent first, with that header raised and its arrow coloured.
    expect(names()).toEqual(['Cy', 'Bo', 'Ann']);
    expect(header('Last Seen').props['aria-sort']).toBe('descending');
    expect(header('Last Seen').findByType('button').props.className).toMatch(/font-semibold/);
    expect(header('Last Seen').findByType('button').props.title).toBe('Sorted by Last Seen, most recent first. Click to reverse.');
    expect(text(renderer.root.findByType('caption'))).toBe('Patients sorted by Last Seen, most recent first');
    await act(async () => header('English Name').findByType('button').props.onClick());
    expect(names()).toEqual(['Ann', 'Bo', 'Cy']);
    expect(header('English Name').props['aria-sort']).toBe('ascending');
    expect(header('Last Seen').props['aria-sort']).toBeUndefined();
    expect(header('Last Seen').findByType('button').props.className).not.toMatch(/font-semibold/);
    // The arrow points the way the values grow: down for A to Z, up for Z to A.
    const arrow = label => header(label).findByType('button').findByProps({ 'aria-hidden': 'true' }).type;
    expect(arrow('English Name')).toBe(ArrowDown);
    await act(async () => header('English Name').findByType('button').props.onClick());
    expect(names()).toEqual(['Cy', 'Bo', 'Ann']);
    expect(header('English Name').props['aria-sort']).toBe('descending');
    expect(arrow('English Name')).toBe(ArrowUp);
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

  test('a completed visit offers Add or Edit referral, loading the saved one first; open visits offer none', async () => {
    await render([
      person(1, 'Ann', { completed_visit_id: 20, completed_visit_has_referral: true }),
      person(2, 'Bo', { completed_visit_id: 21, completed_visit_has_referral: false }),
      person(3, 'Chan', { queue_visit_id: 7, current_station: 'triage' }),
    ]);
    const referralButton = name => renderer.root.findAll(node => node.type === 'button'
      && /referral for/.test(node.props['aria-label'] || '') && node.props['aria-label'].endsWith(name));
    expect(referralButton('Ann').map(b => b.props.title)).toEqual(['Edit referral']);
    expect(referralButton('Bo').map(b => b.props.title)).toEqual(['Add referral']);
    expect(referralButton('Chan')).toHaveLength(0);
    const ReferralPopUp = require('../src/components/shared/read-only/patient-container/referral/ReferralPopUp').default;
    const saved = { referralType: ['Hospital'] };
    mockGetConsultation.mockResolvedValueOnce({ referral: saved });
    await act(async () => referralButton('Ann')[0].props.onClick());
    expect(mockGetConsultation).toHaveBeenCalledWith(20);
    const popUp = renderer.root.findByType(ReferralPopUp);
    expect(popUp.props).toMatchObject({ showPopUp: true, retrievedReferral: saved, patient: { visit_id: 20, patient_id: 1 } });
  });
});
