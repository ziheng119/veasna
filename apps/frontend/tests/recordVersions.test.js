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

describe('referral and Patient Details', () => {
  const { getConsultation } = require('../src/lib/api/visit/doctors-consultation/getConsultation');
  const { postReferral } = require('../src/lib/api/visit/postReferral');
  const { deleteReferral } = require('../src/lib/api/visit/deleteReferral');
  const { postConsultation } = require('../src/lib/api/visit/doctors-consultation/postConsultation');
  const { updatePatient } = require('../src/lib/api/patient/updatePatient');
  const NOTES = '2026-11-11T02:00:00.000Z', REFERRAL = '2026-11-11T02:05:00.000Z', LATER = '2026-11-11T02:10:00.000Z';
  const referral = { referralDate: '', referralType: ['Optician'], illness: '', duration: '', reason: 'Glasses', signature: null, doctorName: null };
  const notes = { notes: 'Seen', prescription: '', requireReferral: true, conditionCategories: null };

  test("the referral sends the version loaded with the notes, and its save passes the notes' new version on", async () => {
    global.fetch = jest.fn(async () => reply({ id: 1, visit_id: 31, notes: 'Seen', last_updated_at: NOTES, reason: 'Old', referral_updated_at: REFERRAL }));
    await getConsultation(31);
    global.fetch = jest.fn(async () => reply({ visit_id: 31, last_updated_at: LATER, consultation_updated_at: LATER }));
    await postReferral(referral, 31);
    expect(sentVersion()).toBe(REFERRAL);
    // Without the notes' new version, this device's next notes save would be refused as saved elsewhere.
    global.fetch = jest.fn(async () => reply({ visit_id: 31, last_updated_at: LATER }));
    await postConsultation(notes, 31);
    expect(sentVersion()).toBe(LATER);
  });

  test("deleting the referral passes the notes' new version on, and the next referral is a first entry", async () => {
    global.fetch = jest.fn(async () => reply({ id: 1, visit_id: 32, last_updated_at: NOTES, reason: 'Old', referral_updated_at: REFERRAL }));
    await getConsultation(32);
    global.fetch = jest.fn(async () => reply({ consultation_updated_at: LATER }));
    await deleteReferral(32);
    global.fetch = jest.fn(async () => reply({ visit_id: 32, last_updated_at: LATER }));
    await postConsultation(notes, 32);
    expect(sentVersion()).toBe(LATER);
    await postReferral(referral, 32);
    expect(sentVersion()).toBeNull();
  });

  test('a referral refused as saved elsewhere (409) reloads the open dialog', async () => {
    global.fetch = jest.fn(async () => reply({ id: 1, visit_id: 33, last_updated_at: NOTES, referral_updated_at: REFERRAL }));
    await getConsultation(33);
    const changes = jest.spyOn(useRealtimeStore.getState(), 'noteVisitChanges');
    global.fetch = jest.fn(async () => reply({ error: 'This form was saved on another device after you opened it.' }, 409));
    await expect(postReferral(referral, 33)).rejects.toThrow('saved on another device');
    expect(changes).toHaveBeenCalledWith([33]);
    changes.mockRestore();
  });

  test('a Patient Details save sends the version shown, and a 409 is reported as a conflict', async () => {
    global.fetch = jest.fn(async () => reply({ error: 'These details were changed on another device after you opened them.' }, 409));
    const result = await updatePatient(5, { english_name: 'Sokha', sex: 'F', date_of_birth: '1990-01-01' }, 't', NOTES);
    expect(sentVersion()).toBe(NOTES);
    expect(result).toEqual({ success: false, conflict: true, error: 'These details were changed on another device after you opened them.' });
  });
});
