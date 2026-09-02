// tests/pharmacy_dispense.test.js

const { app, request, registerAndLogin, getLocationId } = require('./helpers/api');

describe('Pharmacy dispensing', () => {
  let token;
  let locationId;

  beforeAll(async () => {
    ({ token } = await registerAndLogin());
    locationId = await getLocationId(token);
  });

  async function addDrug(stock) {
    const res = await request(app)
      .post('/api/pharmacy')
      .set('Authorization', `Bearer ${token}`)
      .send({ location_id: locationId, drug_name: `Drug ${Date.now()}-${Math.random()}`, stock_count: stock });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  function dispense(drugId, quantity) {
    return request(app)
      .post(`/api/pharmacy/${drugId}/dispense`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity });
  }

  test('decrements stock and returns the updated row', async () => {
    const drugId = await addDrug(10);

    const res = await dispense(drugId, 3);
    expect(res.status).toBe(200);
    expect(res.body.stock_count).toBe(7);

    const list = await request(app)
      .get(`/api/pharmacy?location_id=${locationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.find((d) => d.id === drugId).stock_count).toBe(7);
  });

  test('rejects dispensing more than available (409) without changing stock', async () => {
    const drugId = await addDrug(5);

    const res = await dispense(drugId, 9);
    expect(res.status).toBe(409);
    expect(res.body.available).toBe(5);

    const after = await dispense(drugId, 5);
    expect(after.status).toBe(200);
    expect(after.body.stock_count).toBe(0);
  });

  test('404 for an unknown drug, 400 for a bad quantity', async () => {
    expect((await dispense(99999999, 1)).status).toBe(404);

    const drugId = await addDrug(5);
    expect((await dispense(drugId, 0)).status).toBe(400);
    expect((await dispense(drugId, -2)).status).toBe(400);
    expect((await dispense(drugId, 1.5)).status).toBe(400);
  });

  test('concurrent dispenses cannot oversell', async () => {
    const drugId = await addDrug(10);

    const results = await Promise.all([
      dispense(drugId, 6),
      dispense(drugId, 6),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);

    const list = await request(app)
      .get(`/api/pharmacy?location_id=${locationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.find((d) => d.id === drugId).stock_count).toBe(4);
  });

  test('requires a token', async () => {
    const drugId = await addDrug(1);
    const res = await request(app)
      .post(`/api/pharmacy/${drugId}/dispense`)
      .send({ quantity: 1 });
    expect(res.status).toBe(401);
  });
});
