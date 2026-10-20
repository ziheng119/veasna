const { getQueue, clearQueueCache } = require('../src/lib/api/queue/getQueue');
const { getPatientsByLocation, clearPatientsByLocationCache } = require('../src/lib/api/patients/getPatientsByLocation');
const loaders = [
  ['queue', signal => getQueue(1, '2026-10-19', 'token', 'triage', signal), clearQueueCache],
  ['patients', signal => getPatientsByLocation(1, 'token', '2026-10-19', signal), clearPatientsByLocationCache],
];

describe.each(loaders)('Live %s API reads', (_name, load, clear) => {
  let originalFetch, logs;
  beforeEach(() => {
    clear(); originalFetch = global.fetch; global.fetch = jest.fn();
    logs = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { global.fetch = originalFetch; logs.mockRestore(); });
  test('bypasses cached responses and passes cancellation to fetch', async () => {
    const signal = new AbortController().signal;
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => [{ id: 1 }], headers: new Headers() });
    expect(await load(signal)).toEqual([{ id: 1 }]);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('location_id=1');
    expect(url).toContain('2026-10-19');
    expect(options.signal).toBe(signal);
    expect(options.cache).toBe('no-store');
    expect(options.headers['If-None-Match']).toBeUndefined();
  });
  test('surfaces failures rather than returning an empty or stale successful list', async () => {
    fetch.mockRejectedValue(new Error('offline'));
    await expect(load(new AbortController().signal)).rejects.toThrow('offline');
  });
});
