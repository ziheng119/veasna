// A save from a form opened before another device saved is refused by the host and the form offers
// the saved version (lib/api/recordVersions.ts, with lib/api/visit/dental.ts as the example).
const { getDental, postDental } = require('../src/lib/api/visit/dental');
const { useUserStore } = require('../src/stores/useUserStore');
const { useRealtimeStore } = require('../src/stores/useRealtimeStore');

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const sentVersion = () => JSON.parse(global.fetch.mock.calls.at(-1)[1].body).expected_updated_at;
let originalFetch;
beforeEach(() => {
  originalFetch = global.fetch;
  useUserStore.setState({ user: { id: 1, username: 'Dentist', role: 'user', token: 't' } });
});
afterEach(() => { global.fetch = originalFetch; });

test('each save sends the version this device last loaded or saved', async () => {
  global.fetch = jest.fn(async () => reply(null)); // no notes yet
  await getDental(21);
  global.fetch = jest.fn(async () => reply({ visit_id: 21, last_updated_at: '2026-11-11T02:00:00.000Z' }));
  await postDental(21, { notes: 'Cleaned', referral_needed: false });
  expect(sentVersion()).toBeNull(); // first entry: the form saw no record
  await postDental(21, { notes: 'Cleaned teeth', referral_needed: false });
  expect(sentVersion()).toBe('2026-11-11T02:00:00.000Z');
});

test('a record never loaded on this device is saved without a check', async () => {
  global.fetch = jest.fn(async () => reply({ visit_id: 22, last_updated_at: '2026-11-11T02:00:00.000Z' }));
  await postDental(22, { notes: 'Walk-in', referral_needed: false });
  expect(sentVersion()).toBeUndefined();
});

test("refused as saved elsewhere since (409): the host's message, and the open form reloads the record", async () => {
  global.fetch = jest.fn(async () => reply({ visit_id: 23, notes: 'Old', last_updated_at: '2026-11-11T02:00:00.000Z' }));
  await getDental(23);
  const changes = jest.spyOn(useRealtimeStore.getState(), 'noteVisitChanges');
  global.fetch = jest.fn(async () => reply({ error: 'This form was saved on another device after you opened it.' }, 409));
  await expect(postDental(23, { notes: 'Mine', referral_needed: false })).rejects.toThrow('This form was saved on another device after you opened it.');
  expect(changes).toHaveBeenCalledWith([23]);
  changes.mockRestore();
});
