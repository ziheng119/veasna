// tests/visit_flow.test.js
//
// Exercises the real clinic workflow the frontend uses:
//   register a visit -> appears in today's queue -> triage saved ->
//   discharge -> leaves the queue.

const { app, request, registerAndLogin, getLocationId } = require('./helpers/api');

const today = () => new Date().toISOString().slice(0, 10);

function visitPayload(locationId, queueNo) {
  return {
    patientInfo: {
      english_name: 'Alice Test',
      khmer_name: 'អាលីស',
      date_of_birth: '1995-01-01',
      sex: 'F',
      phone_number: '+85512000000',
      address: 'Somewhere',
      location_id: locationId,
    },
    visit: { queue_no: queueNo },
    vitals: {
      height: 160,
      weight: 50,
      bmi: 19.5,
      below_3rd_percentile: false,
      bp_systolic: 110,
      bp_diastolic: 70,
      temperature: 36.6,
      notes: '',
    },
    hef: { know_of_hef: 'yes', has_hef: 'no', notes: '' },
  };
}

describe('Visit workflow', () => {
  let token;
  let locationId;

  beforeAll(async () => {
    ({ token } = await registerAndLogin());
    locationId = await getLocationId(token);
  });

  test('POST /api/visits creates patient + visit + vitals + hef', async () => {
    const queueNo = `T${Date.now() % 100000}`;
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${token}`)
      .send(visitPayload(locationId, queueNo));

    expect(res.status).toBe(201);
    expect(res.body.visit_id).toEqual(expect.any(Number));
    expect(res.body.patient_id).toEqual(expect.any(Number));
    expect(res.body.queue_no).toBe(queueNo);
  });

  test('the new visit shows up in today\'s queue, then leaves it after discharge', async () => {
    const queueNo = `Q${Date.now() % 100000}`;
    const created = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${token}`)
      .send(visitPayload(locationId, queueNo));
    const visitId = created.body.visit_id;

    const queued = await request(app)
      .get(`/api/queue?location_id=${locationId}&date=${today()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(queued.status).toBe(200);
    expect(queued.body.some((v) => v.visit_id === visitId)).toBe(true);

    const done = await request(app)
      .post(`/api/queue/${visitId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(done.status).toBe(200);

    const after = await request(app)
      .get(`/api/queue?location_id=${locationId}&date=${today()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.some((v) => v.visit_id === visitId)).toBe(false);

    // completing again is idempotent
    const again = await request(app)
      .post(`/api/queue/${visitId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(200);
  });

  test('triage visual-acuity upserts and reads back for the visit', async () => {
    const queueNo = `V${Date.now() % 100000}`;
    const created = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${token}`)
      .send(visitPayload(locationId, queueNo));
    const { visit_id: visitId, patient_id: patientId } = created.body;

    const save = await request(app)
      .post('/api/triage/visual-acuity')
      .set('Authorization', `Bearer ${token}`)
      .send({
        visit_id: visitId,
        left_with_pinhole: 6,
        left_without_pinhole: 12,
        right_with_pinhole: 6,
        right_without_pinhole: 9,
        notes: 'initial',
      });
    expect(save.status).toBe(200);

    const read = await request(app)
      .get(`/api/visits/visual-acuity/${patientId}/${visitId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(Number(read.body.left_without_pinhole)).toBe(12);

    // re-save (ON CONFLICT path)
    const resave = await request(app)
      .post('/api/triage/visual-acuity')
      .set('Authorization', `Bearer ${token}`)
      .send({
        visit_id: visitId,
        left_with_pinhole: 6,
        left_without_pinhole: 6,
        right_with_pinhole: 6,
        right_without_pinhole: 6,
        notes: 'corrected',
      });
    expect(resave.status).toBe(200);
    expect(Number(resave.body.left_without_pinhole)).toBe(6);
  });

  test('a duplicate active queue number is rejected, and reusable after discharge', async () => {
    const queueNo = `D${Date.now() % 100000}`;

    const first = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${token}`)
      .send(visitPayload(locationId, queueNo));
    expect(first.status).toBe(201);

    const clash = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${token}`)
      .send(visitPayload(locationId, queueNo));
    expect(clash.status).toBe(409);

    // discharge the first, then the number is free again
    await request(app)
      .post(`/api/queue/${first.body.visit_id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    const reused = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${token}`)
      .send(visitPayload(locationId, queueNo));
    expect(reused.status).toBe(201);
  });

  test('triage presenting-complaint and history save and read back for prefill', async () => {
    const queueNo = `P${Date.now() % 100000}`;
    const created = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${token}`)
      .send(visitPayload(locationId, queueNo));
    const { visit_id: visitId, patient_id: patientId } = created.body;

    // nothing saved yet -> 404 (frontend treats this as "blank form")
    const empty = await request(app)
      .get(`/api/visits/presenting-complaint/${patientId}/${visitId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(404);

    await request(app)
      .post('/api/triage/presenting-complaint')
      .set('Authorization', `Bearer ${token}`)
      .send({
        visit_id: visitId,
        history: 'cough 3 days',
        red_flags: 'none',
        systems_review: 'unremarkable',
        drug_allergies: 'penicillin',
      });
    await request(app)
      .post('/api/triage/history')
      .set('Authorization', `Bearer ${token}`)
      .send({
        visit_id: visitId,
        past: 'asthma',
        drug_and_treatment: 'salbutamol',
        family: 'nil',
        social: 'non-smoker',
        systems_review: 'nil',
      });

    const pc = await request(app)
      .get(`/api/visits/presenting-complaint/${patientId}/${visitId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(pc.status).toBe(200);
    expect(pc.body.history).toBe('cough 3 days');
    expect(pc.body.drug_allergies).toBe('penicillin');

    const hx = await request(app)
      .get(`/api/visits/history/${patientId}/${visitId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(hx.status).toBe(200);
    expect(hx.body.past).toBe('asthma');
  });

  test('POST /api/visits requires a token', async () => {
    const res = await request(app)
      .post('/api/visits')
      .send(visitPayload(locationId, 'NOAUTH'));
    expect(res.status).toBe(401);
  });
});
