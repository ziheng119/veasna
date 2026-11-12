// Analytics: patients by referral destination (components/analytics/ReferralListsSection.tsx) and its
// printable list (components/analytics/referralListDocument.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('next/link', () => ({ __esModule: true, default: props => React.createElement('a', props) }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('../src/lib/api/analytics', () => ({ getAnalyticsReferrals: jest.fn() }));
jest.mock('../src/lib/printDocument', () => ({ writeAndPrint: jest.fn() }));
const toast = require('react-hot-toast').default;
const { getAnalyticsReferrals } = require('../src/lib/api/analytics');
const { writeAndPrint } = require('../src/lib/printDocument');
const ReferralListsSection = require('../src/components/analytics/ReferralListsSection').default;
const { referralListDocumentHtml, ageSex } = require('../src/components/analytics/referralListDocument');
global.IS_REACT_ACT_ENVIRONMENT = true;

const text = node => (node.children ?? []).flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
const patient = (visitId, englishName, extra = {}) => ({
  visitId, patientId: visitId + 100, queueNo: String(visitId), visitDate: '2026-10-21',
  englishName, khmerName: null, sex: 'F', dateOfBirth: null, age: 40, phone: null, address: null,
  referralDate: null, condition: '', reason: '', signed: true, ...extra,
});
const lists = destinations => ({ date: '2026-10-21', period: 'day', generatedAt: '2026-10-21T01:00:00Z', destinations });
const SAMPLE = [
  { label: 'Preah Ang Duong Hospital', listed: true, patients: [] },
  { label: 'Samdech Ov Referral Hospital', listed: true, patients: [
    patient(1, 'Ben', { khmerName: 'បេន', phone: '012 345 678', address: 'Village A', condition: 'Cataract', reason: 'Needs surgery' }),
    patient(2, 'Bob', { signed: false, age: null, sex: null }),
  ] },
  { label: 'Optician', listed: true, patients: [patient(3, 'Beb')] },
  { label: 'Bong Bondol', listed: false, patients: [patient(4, 'Old')] },
];
const props = { icon: () => null, tone: '', date: '2026-10-21', period: 'day', dateRange: '21 Oct 2026', token: 't', refresh: 0 };

let renderer, log, popup;
beforeEach(() => {
  log = jest.spyOn(console, 'error').mockImplementation(() => {});
  popup = {};
  window.open = jest.fn(() => popup);
  jest.clearAllMocks();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
  log.mockRestore();
});
global.window = global.window ?? {};

const render = async (overrides = {}) => {
  await act(async () => { renderer = create(React.createElement(ReferralListsSection, { ...props, ...overrides })); });
};
const button = label => renderer.root.findAll(node => node.type === 'button' && text(node).includes(label))[0];
const shownPatients = () => renderer.root.findAllByType('ol').flatMap(list => list.findAllByType('a').map(text));

test('opens on the first destination with patients, numbered in order, and switches on click', async () => {
  getAnalyticsReferrals.mockResolvedValue(lists(SAMPLE));
  await render();
  expect(getAnalyticsReferrals).toHaveBeenCalledWith('2026-10-21', 'day', 't', expect.any(Object));
  expect(shownPatients()).toEqual(['Ben', 'Bob']);
  const all = text(renderer.root);
  expect(all).toContain('2 patients');
  expect(all).toContain('បេន');
  expect(all).toContain('012 345 678 · Village A');
  expect(all).toContain('Cataract: Needs surgery');
  // Bob has no age or sex recorded and an unsigned referral.
  expect(all).toContain('Queue 2 · 21 Oct 2026 · Unsigned draft');
  expect(all).toContain('No longer on the destination list');
  expect(renderer.root.findByProps({ href: '/patient-details?id=101' })).toBeTruthy();
  expect(button('Samdech Ov Referral Hospital').props['aria-pressed']).toBe(true);

  await act(async () => button('Optician').props.onClick());
  expect(shownPatients()).toEqual(['Beb']);
  expect(button('Optician').props['aria-pressed']).toBe(true);

  await act(async () => button('Preah Ang Duong Hospital').props.onClick());
  expect(text(renderer.root)).toContain('No patients referred to Preah Ang Duong Hospital in this period.');
  expect(button('Print list').props.disabled).toBe(true);
});

test('prints one list or every list, and says when there is nothing to print', async () => {
  getAnalyticsReferrals.mockResolvedValue(lists(SAMPLE));
  await render();
  await act(async () => button('Print list').props.onClick());
  expect(writeAndPrint).toHaveBeenCalledTimes(1);
  expect(writeAndPrint.mock.calls[0][0]).toBe(popup);
  expect(writeAndPrint.mock.calls[0][1]).toContain('Samdech Ov Referral Hospital');
  expect(writeAndPrint.mock.calls[0][1]).not.toContain('Beb');

  await act(async () => button('Print all lists').props.onClick());
  const html = writeAndPrint.mock.calls[1][1];
  expect(html).toContain('Ben');
  expect(html).toContain('Beb');
  // A destination with nobody on it gets no page.
  expect(html).not.toContain('Preah Ang Duong Hospital');

  window.open.mockReturnValueOnce(null);
  await act(async () => button('Print list').props.onClick());
  expect(toast.error).toHaveBeenCalledWith('Allow pop-ups to print referral lists.');
});

test('no referrals in the period: a clear message and printing is off', async () => {
  getAnalyticsReferrals.mockResolvedValue(lists(SAMPLE.slice(0, 1)));
  await render();
  expect(text(renderer.root)).toContain('No referrals saved for this period.');
  expect(button('Print all lists').props.disabled).toBe(true);
});

test('a failed load says so and can be retried', async () => {
  getAnalyticsReferrals.mockRejectedValueOnce(new Error('Unable to load referral lists. Please try again.'));
  await render();
  const alert = renderer.root.findByProps({ role: 'alert' });
  expect(text(alert)).toContain('Unable to load referral lists.');
  getAnalyticsReferrals.mockResolvedValueOnce(lists(SAMPLE));
  await act(async () => button('Try again').props.onClick());
  expect(renderer.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
  expect(shownPatients()).toEqual(['Ben', 'Bob']);
});

test('the printout escapes patient text and shows one page per destination', () => {
  const html = referralListDocumentHtml([
    { label: 'Optician', listed: true, patients: [patient(1, '<script>x</script>', { reason: 'Blurred' })] },
    { label: 'Empty', listed: true, patients: [] },
  ], { dateRange: '21 Oct 2026', logoUrl: 'http://host/btb-logo.png' });
  expect(html).not.toContain('<script>x');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('http://host/btb-logo.png');
  expect(html).toContain('1 patient<');
  expect(html.match(/<article>/g)).toHaveLength(1);
  expect(ageSex({ age: 34, sex: 'F' })).toBe('34 · F');
  expect(ageSex({ age: null, sex: null })).toBe('–');
});
