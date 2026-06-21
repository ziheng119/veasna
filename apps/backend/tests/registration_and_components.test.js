// tests/registration_and_components.test.js

const request = require('supertest');
const app = require('../server');

const pickLocationId = async () => {
  const r = await request(app).get('/api/locations');
  return r.body.locations[0].id;
};

describe('Combined registration + component CRUD + queue', () => {
  let patientId;
  let vitalsId;
  let hefId;
  let visitId;
  let locationId;

  beforeAll(async () => {
    locationId = await pickLocationId();
  });

  test('POST /api/registration creates patient + vitals + hef + visit (public)', async () => {
    const res = await request(app)
      .post('/api/registration')
      .send({
        patient: {
          english_name: 'Alice Test',
          khmer_name: 'អាលីស',
          date_of_birth: '1995-01-01',
          sex: 'female',
          phone_number: '+85512345',
          address: 'Somewhere',
          location_id: locationId
        },
        vitals: {
          height_cm: 160, weight_kg: 50, bmi: 19.5, blood_pressure: '110/70', temperature_c: 36.6
        },
        hef: { know_hef: true, have_hef: false, hef_notes: 'N/A' },
        visit: { location_id: locationId, visit_date: '2025-08-12', queue_no: '2a' } // lower-case to test uppercasing
      });

    expect(res.status).toBe(201);
    expect(res.body.patient.id).toBeDefined();
    patientId = res.body.patient.id;

    expect(res.body.vitals.id).toBeDefined();
    vitalsId = res.body.vitals.id;

    expect(res.body.hef.id).toBeDefined();
    hefId = res.body.hef.id;

    expect(res.body.visit.id).toBeDefined();
    visitId = res.body.visit.id;

    // queue mirrored to patient
    expect(res.body.patient.queue_no).toBe('2A');
  });

  test('GET /api/patients?location_id filters by location and returns location_name', async () => {
    const res = await request(app).get(`/api/patients?location_id=${locationId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find(p => p.id === patientId);
    expect(found).toBeTruthy();
    expect(found.location_name).toBeDefined();
  });

  test('Individual Vitals: PUT updates, GET lists, DELETE removes', async () => {
    const upd = await request(app)
      .put(`/api/patients/${patientId}/vitals/${vitalsId}`)
      .send({ weight_kg: 51 });
    expect(upd.status).toBe(200);
    expect(parseFloat(upd.body.weight_kg)).toBe(51);

    const list = await request(app).get(`/api/patients/${patientId}/vitals`);
    expect(list.status).toBe(200);
    expect(list.body.some(v => v.id === vitalsId)).toBe(true);

    const del = await request(app).delete(`/api/patients/${patientId}/vitals/${vitalsId}`);
    expect(del.status).toBe(200);
  });

  test('Individual HEF: PUT updates, GET lists, DELETE removes', async () => {
    const upd = await request(app)
      .put(`/api/patients/${patientId}/hef/${hefId}`)
      .send({ have_hef: true });
    expect(upd.status).toBe(200);
    expect(upd.body.have_hef).toBe(true);

    const list = await request(app).get(`/api/patients/${patientId}/hef`);
    expect(list.status).toBe(200);
    expect(list.body.some(h => h.id === hefId)).toBe(true);

    const del = await request(app).delete(`/api/patients/${patientId}/hef/${hefId}`);
    expect(del.status).toBe(200);
  });

  test('Combined update: PUT /api/registration/:patientId can update patient & visit queue', async () => {
    const res = await request(app)
      .put(`/api/registration/${patientId}`)
      .send({
        patient: { phone_number: '+855999' },
        visit: { location_id: locationId, visit_date: '2025-08-12', queue_no: '3B' }
      });
    expect(res.status).toBe(200);
    expect(res.body.visit.queue_no).toBe('3B');

    // queue mirrored
    const getP = await request(app).get(`/api/patients?location_id=${locationId}`);
    const found = getP.body.find(p => p.id === patientId);
    expect(found.queue_no).toBe('3B');
  });

  test('Visit queue update endpoint also mirrors to patient', async () => {
    const res = await request(app)
      .put(`/api/visits/${visitId}`)
      .send({ queue_no: '10C' });
    expect(res.status).toBe(200);
    expect(res.body.queue_no).toBe('10C');

    const getP = await request(app).get(`/api/patients?location_id=${locationId}`);
    const found = getP.body.find(p => p.id === patientId);
    expect(found.queue_no).toBe('10C');
  });

  test('Combined delete removes patient (and cascades)', async () => {
    const del = await request(app).delete(`/api/registration/${patientId}`);
    expect(del.status).toBe(200);
  });
});
