// Registrations that are safe to send again (lib/requestId.ts, lib/api/visit/createVisit.ts).
const { newRequestId, retryableRequestId } = require('../src/lib/requestId');
const { createVisit } = require('../src/lib/api/visit/createVisit');

test('request ids are 32 random hex characters, made without HTTPS', () => {
  const ids = new Set(Array.from({ length: 50 }, newRequestId));
  expect(ids.size).toBe(50);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
});

test('a registration keeps its id after a failure and gets a new one once saved', () => {
  const registration = retryableRequestId();
  const first = registration.get();
  // Failed (perhaps saved on the host, answer lost): Submit again sends the same id.
  expect(registration.get()).toBe(first);
  registration.saved();
  expect(registration.get()).not.toBe(first);
});

test('createVisit sends the request id', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ visit_id: 1 }) });
  try {
    await createVisit({ patientInfo: {}, vitals: {}, hef: {}, stations: ['triage'], request_id: 'abc123def456' }, 't');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ request_id: 'abc123def456' });
  } finally {
    global.fetch = originalFetch;
  }
});
