const { getQueue, clearQueueCache } = require('../src/lib/api/queue/getQueue');
const { getPatientList, clearPatientListCache } = require('../src/lib/api/patients/getPatientList');
const loaders = [
  ['queue', signal => getQueue('2026-10-19', 'token', 'triage', signal), clearQueueCache],
  ['patients', signal => getPatientList('token', '2026-10-19', signal), clearPatientListCache],
];

describe.each(loaders)('Live %s API reads', (_name, load, clear) => {
  let originalFetch, logs;
  beforeEach(() => {
    clear(); originalFetch = global.fetch; global.fetch = jest.fn();
    logs = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { global.fetch = originalFetch; logs.mockRestore(); });
  test('always revalidates with the server and passes cancellation to fetch', async () => {
    const caller = new AbortController();
    const signal = caller.signal;
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => [{ id: 1 }], headers: new Headers() });
    expect(await load(signal)).toEqual([{ id: 1 }]);
    const [url, options] = fetch.mock.calls[0];
    // One clinic: no location is sent.
    expect(url).not.toContain('location_id');
    expect(url).toContain('2026-10-19');
    // Cancelling the caller's signal cancels the request (lib/api/request.ts adds a timeout of its own).
    expect(options.signal.aborted).toBe(false);
    caller.abort();
    expect(options.signal.aborted).toBe(true);
    // "no-cache" never serves a stored list unchecked; unchanged lists return 304 with no body.
    expect(options.cache).toBe('no-cache');
    expect(options.headers['If-None-Match']).toBeUndefined();
  });
  test('surfaces failures rather than returning an empty or stale successful list', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(load(new AbortController().signal)).rejects.toThrow("Couldn't reach the host laptop. Check the Wi-Fi, then try again.");
  });
});

test('CLINIC_TODAY lets the backend choose today, so device clocks cannot split the queue', async () => {
  const { getQueue, CLINIC_TODAY, clearQueueCache } = require('../src/lib/api/queue/getQueue');
  const originalFetch = global.fetch;
  const logs = jest.spyOn(console, 'log').mockImplementation(() => {});
  clearQueueCache();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [], headers: new Headers() });
  try {
    await getQueue(CLINIC_TODAY, 'token', 'triage', new AbortController().signal);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.has('date')).toBe(false);
    expect(url.searchParams.has('location_id')).toBe(false);
    expect(url.searchParams.get('station')).toBe('triage');
  } finally {
    global.fetch = originalFetch;
    logs.mockRestore();
  }
});
