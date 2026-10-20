const { updateVisitStations } = require('../src/lib/api/queue/stations');
test('ordered saves include the original snapshot and preserve caller order', async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  try {
    const snapshot = [{ station: 'triage', completed: true }, { station: 'seva', completed: false }];
    await updateVisitStations(7, ['seva', 'triage'], 'token', snapshot);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ stations: ['seva', 'triage'], ordered: true, expected_stations: snapshot });
  } finally { global.fetch = original; }
});
test('a stale route response surfaces a useful error', async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'The route changed on another device.' }) });
  try { await expect(updateVisitStations(7, ['seva'], 'token', [])).rejects.toThrow('The route changed'); }
  finally { global.fetch = original; }
});
