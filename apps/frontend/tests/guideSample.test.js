// The guided tour's sample patient (lib/guide/sample.ts): during the tour, apiFetch answers the
// queues and the sample's records itself, so the station pages show a filled-in patient and
// nothing reaches the host. Each reply goes through the app's own loaders here, as on the page.
const { useGuideStore } = require('../src/stores/useGuideStore');
const { useUserStore } = require('../src/stores/useUserStore');
const { sampleReply, sampleWasShown, forgetSample } = require('../src/lib/guide/sample');
const { SAMPLE_ID } = require('../src/lib/guide/sampleId');
const { apiFetch } = require('../src/lib/api/request');
const { getQueue, CLINIC_TODAY } = require('../src/lib/api/queue/getQueue');
const { getPatient } = require('../src/lib/api/patients/getPatient');
const { getVitals } = require('../src/lib/api/visit/getVitals');
const { getTriageRecord } = require('../src/lib/api/triage/triageService');
const { getDental, postDental } = require('../src/lib/api/visit/dental');
const { getConsultation } = require('../src/lib/api/visit/doctors-consultation/getConsultation');
const { getPhysiotherapy } = require('../src/lib/api/visit/physiotherapy/getPhysiotherapy');
const { getSeva } = require('../src/lib/api/visit/seva/getSeva');
const { getTbScreening } = require('../src/lib/api/tb/tb');
const { getVisitPrescriptions, getLocationPrescriptions } = require('../src/lib/api/pharmacy/prescriptions');

let originalFetch;
beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = jest.fn(async () => new Response('[]', { status: 200 }));
  useUserStore.setState({ user: { id: 1, username: 'Nurse', role: 'user', token: 't' } });
  useGuideStore.setState({ active: true, index: 0 });
  forgetSample();
});
afterEach(() => { global.fetch = originalFetch; useGuideStore.setState({ active: false }); });

test('each station queue holds only the sample, waiting there with the stations before it done', async () => {
  const [dental] = await getQueue(3, CLINIC_TODAY, 't', 'dental');
  expect(dental).toMatchObject({ visit_id: SAMPLE_ID, current_station: 'dental', english_name: expect.stringContaining('sample') });
  expect(dental.stations.slice(0, 2)).toEqual([{ station: 'triage', completed: true }, { station: 'dental', completed: false }]);
  // Home's queue: the sample waits for Triage.
  expect((await getQueue(3, CLINIC_TODAY, 't'))[0].current_station).toBe('triage');
  expect(global.fetch).not.toHaveBeenCalled();
  expect(sampleWasShown()).toBe(true);
});

test("every station's records for the sample load, filled in", async () => {
  expect(await getPatient(SAMPLE_ID)).toMatchObject({ id: SAMPLE_ID, date_of_birth: expect.any(String) });
  expect(await getVitals(SAMPLE_ID, SAMPLE_ID)).toMatchObject({ bp_systolic: '128', temperature: '36.8' });
  expect(await getTriageRecord('visual-acuity', SAMPLE_ID, SAMPLE_ID)).toMatchObject({ right_with_pinhole: '6/6' });
  expect(await getTriageRecord('presenting-complaint', SAMPLE_ID, SAMPLE_ID)).toMatchObject({ history: expect.stringContaining('Toothache') });
  expect(await getTriageRecord('history', SAMPLE_ID, SAMPLE_ID)).toMatchObject({ past: 'High blood pressure' });
  expect(await getTbScreening(SAMPLE_ID, 't')).toBeNull();
  expect(await getDental(SAMPLE_ID)).toMatchObject({ notes: expect.stringContaining('molar'), referral_needed: false });
  expect(await getConsultation(SAMPLE_ID)).toMatchObject({ hasSavedNotes: true, notes: expect.stringContaining('Physiotherapy'), referral: null });
  expect(await getPhysiotherapy(SAMPLE_ID)).toMatchObject({ painpoints: [{ xCoord: 50, yCoord: 44 }] });
  expect(await getSeva(SAMPLE_ID)).toMatchObject({ diagnosis: 'Early cataract, left eye', dateOfReferral: null });
  // Pharmacy: the sample's prescription waits to be dispensed.
  expect(await getVisitPrescriptions(SAMPLE_ID)).toEqual([expect.objectContaining({ visit_id: SAMPLE_ID, status: 'pending' })]);
  expect(await getLocationPrescriptions(3, 'pending')).toEqual([expect.objectContaining({ drug_name: 'Paracetamol 500 mg', location_id: 3 })]);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('saving the sample is refused without reaching the host', async () => {
  await expect(postDental(SAMPLE_ID, { notes: 'x', referral_needed: false })).rejects.toThrow(/sample patient/);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('everything else goes to the host as usual, and so does everything once the tour ends', async () => {
  expect(sampleReply('http://192.168.1.10:4000/api/pharmacy?location_id=3')).toBeNull();
  expect(sampleReply('http://192.168.1.10:4000/api/visits/dental/12', 'POST')).toBeNull();
  // A sample record the tour doesn't have: not found, rather than a real visit.
  expect(sampleReply(`http://h/api/patient/visit/${SAMPLE_ID}`).status).toBe(404);

  useGuideStore.setState({ active: false });
  await apiFetch('http://h/api/queue?location_id=3');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(sampleWasShown()).toBe(false);
});
