const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/lib/api/visit/getDailyReferrals', () => ({ getDailyReferrals: jest.fn() }));
jest.mock('../src/components/doctors-consultation/ReferralDocument', () => ({ referralBatchDocumentHtml: jest.fn(() => '<html>Batch</html>') }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { error: jest.fn() }) }));
const { getDailyReferrals } = require('../src/lib/api/visit/getDailyReferrals');
const PrintDailyReferrals = require('../src/components/doctors-consultation/PrintDailyReferrals').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test('batch printing handles missing location, popup blocking, no results, errors and success', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const popup = { document: { body: {}, open: jest.fn(), write: jest.fn(), close: jest.fn() }, close: jest.fn(), focus: jest.fn(), print: jest.fn() };
  global.window = { open: jest.fn(() => popup) };
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(PrintDailyReferrals, {})); });
    expect(renderer.root.findByType('button').props.disabled).toBe(true);
    await act(async () => renderer.update(React.createElement(PrintDailyReferrals, { locationId: 4 })));
    const click = () => renderer.root.findByType('button').props.onClick();
    window.open.mockReturnValueOnce(null);
    await act(async () => click());
    expect(getDailyReferrals).not.toHaveBeenCalled();
    getDailyReferrals.mockResolvedValueOnce([]);
    await act(async () => click());
    expect(popup.close).toHaveBeenCalled();
    expect(popup.print).not.toHaveBeenCalled();
    getDailyReferrals.mockRejectedValueOnce(new Error('offline'));
    await act(async () => click());
    expect(popup.print).not.toHaveBeenCalled();
    let resolve;
    getDailyReferrals.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await act(async () => { click(); click(); });
    expect(renderer.root.findByType('button').props.disabled).toBe(true);
    await act(async () => resolve([{ visitId: 1 }]));
    expect(getDailyReferrals).toHaveBeenLastCalledWith(4, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(popup.document.write).toHaveBeenCalledWith('<html>Batch</html>');
    expect(popup.print).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType('button').props.disabled).toBe(false);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    delete global.window; log.mockRestore();
  }
});
