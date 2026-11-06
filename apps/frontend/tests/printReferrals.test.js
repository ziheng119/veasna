// Printing saved referrals for a day, a period or every date (components/shared/PrintReferralsDialog.tsx,
// doctors-consultation/PrintReferrals.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/lib/api/visit/getReferrals', () => ({ getReferrals: jest.fn() }));
jest.mock('../src/components/doctors-consultation/ReferralDocument', () => ({ referralBatchDocumentHtml: jest.fn(() => '<html>Batch</html>') }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('../src/components/ui/button', () => ({ Button: props => require('react').createElement('button', props) }));
jest.mock('../src/components/ui/dialog', () => {
  const { createElement } = require('react');
  const part = name => ({ children }) => createElement('div', { 'data-dialog': name }, children);
  return {
    Dialog: ({ open, children }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    DialogContent: part('content'), DialogHeader: part('header'), DialogFooter: part('footer'),
    DialogTitle: part('title'), DialogDescription: part('description'),
  };
});
const toast = require('react-hot-toast').default;
const { getReferrals } = require('../src/lib/api/visit/getReferrals');
const PrintReferralsDialog = require('../src/components/shared/PrintReferralsDialog').default;
const { todayIso, rangeText } = require('../src/components/shared/PrintReferralsDialog');
const PrintReferrals = require('../src/components/doctors-consultation/PrintReferrals').default;
const { useUserStore } = require('../src/stores/useUserStore');
global.IS_REACT_ACT_ENVIRONMENT = true;

const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');
let renderer, popup, onOpenChange, log;
beforeEach(() => {
  log = jest.spyOn(console, 'error').mockImplementation(() => {});
  popup = { closed: false, document: { body: {}, open: jest.fn(), write: jest.fn(), close: jest.fn() }, close: jest.fn(), focus: jest.fn(), print: jest.fn() };
  global.window = { open: jest.fn(() => popup) };
  onOpenChange = jest.fn();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null; delete global.window; log.mockRestore(); jest.clearAllMocks();
});
const render = async props => {
  await act(async () => { renderer = create(React.createElement(PrintReferralsDialog, { open: true, onOpenChange, locationId: 4, ...props })); });
};
const footerButtons = () => renderer.root.findByProps({ 'data-dialog': 'footer' }).findAllByType('button');
const printButton = () => footerButtons()[1];
const choose = label => act(async () => renderer.root.findAll(n => n.props.role === 'radio' && n.type === 'button').find(n => text(n) === label).props.onClick());
const dateInputs = () => renderer.root.findAllByType('input');

test('Consult\'s "Print referrals" is shown only to admins', async () => {
  useUserStore.setState({ user: { id: 2, username: 'user', role: 'user', token: 't' } });
  await act(async () => { renderer = create(React.createElement(PrintReferrals, { locationId: 4 })); });
  expect(renderer.root.findAllByType('button')).toHaveLength(0);
});

test('Consult\'s "Print referrals" opens a pop-up offering today (the default) or another date', async () => {
  useUserStore.setState({ user: { id: 1, username: 'admin', role: 'admin', token: 't' } });
  await act(async () => { renderer = create(React.createElement(PrintReferrals, { locationId: 4 })); });
  const open = renderer.root.findAllByType('button').find(b => text(b).includes('Print referrals'));
  await act(async () => open.props.onClick());
  expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(1);
  const radios = renderer.root.findAll(n => n.props.role === 'radio' && n.type === 'button');
  expect(radios.map(text)).toEqual(['Today', 'A date']);
  expect(radios[0].props['aria-checked']).toBe(true);
});

test('printing today, then another date', async () => {
  await render();
  getReferrals.mockResolvedValueOnce([{ visitId: 1 }]);
  await act(async () => printButton().props.onClick());
  expect(getReferrals).toHaveBeenLastCalledWith(4, { kind: 'date', date: todayIso() });
  expect(popup.document.write).toHaveBeenCalledWith('<html>Batch</html>');
  expect(popup.print).toHaveBeenCalledTimes(1);
  expect(onOpenChange).toHaveBeenCalledWith(false);

  await choose('A date');
  await act(async () => dateInputs()[0].props.onChange({ target: { value: '2026-10-03' } }));
  getReferrals.mockResolvedValueOnce([]);
  await act(async () => printButton().props.onClick());
  expect(getReferrals).toHaveBeenLastCalledWith(4, { kind: 'date', date: '2026-10-03' });
  expect(popup.close).toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith('No saved referrals on 3 Oct 2026 at this location.');
});

test('analytics can print a period or every date, at every location; a backwards period is refused', async () => {
  await render({ locationId: 'all', choices: ['today', 'date', 'period', 'all'], initialDate: '2026-10-05' });
  await choose('A period');
  const [from, to] = dateInputs();
  expect([from.props.value, to.props.value]).toEqual(['2026-10-05', '2026-10-05']);
  await act(async () => from.props.onChange({ target: { value: '2026-10-09' } }));
  expect(printButton().props.disabled).toBe(true);
  expect(text(renderer.root)).toMatch(/must start on or before/);
  await act(async () => dateInputs()[0].props.onChange({ target: { value: '2026-10-01' } }));
  getReferrals.mockResolvedValueOnce([{ visitId: 1 }]);
  await act(async () => printButton().props.onClick());
  expect(getReferrals).toHaveBeenLastCalledWith('all', { kind: 'period', from: '2026-10-01', to: '2026-10-05' });

  await choose('All dates');
  getReferrals.mockResolvedValueOnce([{ visitId: 1 }]);
  await act(async () => printButton().props.onClick());
  expect(getReferrals).toHaveBeenLastCalledWith('all', { kind: 'all' });
});

test('a blocked pop-up, a failure and a double click are handled', async () => {
  await render();
  window.open.mockReturnValueOnce(null);
  await act(async () => printButton().props.onClick());
  expect(getReferrals).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith('Allow pop-ups to print referrals.');

  getReferrals.mockRejectedValueOnce(new Error('offline'));
  await act(async () => printButton().props.onClick());
  expect(popup.close).toHaveBeenCalled();
  expect(popup.print).not.toHaveBeenCalled();

  let resolve;
  getReferrals.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  await act(async () => { printButton().props.onClick(); printButton().props.onClick(); });
  expect(printButton().props.disabled).toBe(true);
  await act(async () => resolve([{ visitId: 1 }]));
  expect(getReferrals).toHaveBeenCalledTimes(2);
  expect(popup.print).toHaveBeenCalledTimes(1);
});

test('ranges read naturally in messages', () => {
  expect(rangeText({ kind: 'date', date: '2026-11-05' }, '2026-11-05')).toBe('today');
  expect(rangeText({ kind: 'period', from: '2026-11-01', to: '2026-11-05' }, '2026-11-05')).toBe('from 1 Nov 2026 to 5 Nov 2026');
  expect(rangeText({ kind: 'all' })).toBe('on any date');
});
