// Uses only connection-local temporary tables; clinic data is never modified.
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Client } = require('pg');
jest.mock('../config/db', () => ({ query: jest.fn() }));
const db = require('../config/db');

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Clinic analytics', () => {
  let client, app, previousSecret;
  const secret = 'analytics-test-secret';
  const token = (id = 1, role = 'admin') => jwt.sign({ id, role }, secret);
  const get = (auth = token(), query = { date: '2026-10-21' }) => {
    const call = request(app).get('/').query(query);
    return auth ? call.set('Authorization', `Bearer ${auth}`) : call;
  };
  beforeAll(async () => {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    previousSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
    client = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE users (id INT, role TEXT, is_active BOOLEAN, screening_date DATE, permissions TEXT[]);
      INSERT INTO users (id, role, is_active, permissions) VALUES (1,'admin',TRUE,NULL),(2,'user',TRUE,NULL),(3,'admin',FALSE,NULL),(4,'user',TRUE,'{analytics}');
      CREATE TEMP TABLE patients (id INT, date_of_birth DATE);
      INSERT INTO patients VALUES (1,'2000-01-01'),(2,'1950-01-01'),(3,NULL),(4,'2030-01-01');
      CREATE TEMP TABLE visits (id INT, patient_id INT, visit_date DATE, completed_at TIMESTAMP);
      INSERT INTO visits VALUES
        (1,1,'2026-10-21',NOW()),(2,1,'2026-10-21',NULL),(3,2,'2026-10-21',NOW()),
        (4,3,'2026-10-21',NULL),(5,4,'2026-10-21',NULL),
        (7,1,'2026-10-20',NULL);
      CREATE TEMP TABLE visit_stations (visit_id INT, station TEXT, position INT, completed_at TIMESTAMP);
      INSERT INTO visit_stations VALUES
        (1,'consultation',1,NOW()),(2,'consultation',1,NOW()),(3,'consultation',1,NOW()),
        (4,'triage',1,NULL),(4,'seva',2,NULL),(5,'triage',1,NOW()),(5,'consultation',2,NULL),
        (7,'consultation',1,NOW());
      CREATE TEMP TABLE referral (visit_id INT, referral_type TEXT, signature JSONB);
      INSERT INTO referral VALUES (1,E'Dentist\\nDentist\\nSEVA\\n','[]'),(3,'Dentist',NULL);
      CREATE TEMP TABLE consultation (visit_id INT, notes TEXT, condition_categories TEXT[]);
      INSERT INTO consultation (visit_id,notes) VALUES (1,'Clinical note'),(2,'  '),(3,'Note');
    `);
    db.query.mockImplementation((...args) => client.query(...args));
    app = express(); app.use(require('../routes/analytics'));
  });
  afterAll(async () => {
    if (client) await client.end();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  test('enforces authentication and the current analytics permission', async () => {
    expect((await get(null)).status).toBe(401);
    expect((await get(token(2, 'user'))).status).toBe(403); // Not ticked for this account.
    expect((await get(token(4, 'user'))).status).toBe(200); // Ticked.
    expect((await get(token(2))).status).toBe(403); // Stale admin token: the role comes from the database.
    expect((await get(token(1))).status).toBe(200);
    expect((await get(token(3))).status).toBe(403);
  });
  test('counts distinct people, visits, current queues and multi-destination referrals without join inflation', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.summary).toEqual({ consultedVisits: 3, conditionReviewedVisits: 0, people: 4, visits: 5, consultedPeople: 2, dischargedVisits: 2, referralVisits: 2, notesSaved: 2, unsignedReferrals: 1 });
    expect(response.body.stations).toEqual(expect.arrayContaining([
      { station: 'consultation', assigned: 4, completed: 3, waiting: 1 },
      { station: 'triage', assigned: 2, completed: 1, waiting: 1 },
      { station: 'seva', assigned: 1, completed: 0, waiting: 0 },
    ]));
    expect(response.body.ages).toEqual(expect.arrayContaining([{ label: 'Unknown', count: 2 }, { label: '18–59', count: 1 }, { label: '60+', count: 1 }]));
    expect(response.body.destinations).toEqual([{ label: 'Dentist', count: 2 }, { label: 'SEVA', count: 1 }]);
    expect(JSON.stringify(response.body)).not.toContain('Clinical note');
  });
  test('empty dates are zero, invalid filters are rejected', async () => {
    const empty = await get(token(), { date: '2026-10-22' });
    expect(empty.body.summary.people).toBe(0);
    expect(empty.body.stations).toEqual([]);
    for (const filters of [{}, { date: '2026-02-30' }, { date: 'yesterday' }]) {
      expect((await get(token(), filters)).status).toBe(400);
    }
  });
  test('periods include seven calendar dates, exclude future visits and deduplicate people', async () => {
    await client.query(`INSERT INTO patients VALUES (5,'1990-01-01'),(6,'1980-01-01');
      INSERT INTO visits VALUES (8,5,'2026-10-15',NULL),(9,6,'2026-10-14',NULL),(10,6,'2026-10-22',NULL);
      INSERT INTO visit_stations VALUES (8,'consultation',1,NOW()),(9,'consultation',1,NOW());`);
    const period = value => get(token(), {date:'2026-10-21',period:value});
    const day = await period('day'), week = await period('week'), all = await period('all');
    expect(day.body.summary.visits).toBe(5);
    expect(week.body).toMatchObject({period:'week',startDate:'2026-10-15',endDate:'2026-10-21'});
    expect(week.body.summary).toMatchObject({visits:7,people:5,consultedPeople:3});
    expect(all.body.startDate).toBeNull();
    expect(all.body.summary).toMatchObject({visits:8,people:6,consultedPeople:4});
    expect((await period('invalid')).status).toBe(400);
  });

  test('all seven categories count distinct consulted patients, not mentions, repeat visits or pending stations', async () => {
    const ids = require('../../../shared/consultationConditions.json').map(item => item.id);
    const before = await get();
    expect(before.body.conditions).toHaveLength(7);
    expect(before.body.conditions.every(item => item.count === 0)).toBe(true);
    expect(before.body.summary.conditionReviewedVisits).toBe(0);
    await client.query('UPDATE consultation SET condition_categories=$1 WHERE visit_id IN (1,2)', [ids]);
    await client.query("UPDATE consultation SET condition_categories='{}' WHERE visit_id=3");
    await client.query('INSERT INTO consultation (visit_id,notes,condition_categories) VALUES (4,$1,$2),(7,$1,$2)', ['Clinical note',ids]);
    for (const period of ['day','week','all']) {
      const result = await get(token(), {date:'2026-10-21',period});
      expect(result.body.conditions.map(item => item.id)).toEqual(ids);
      expect(result.body.conditions.every(item => item.count === 1)).toBe(true);
    }
    expect((await get()).body.summary.conditionReviewedVisits).toBe(3);
  });

  test('a location sent by an older client is ignored', async () => {
    const older = await get(token(), { location_id: 2, date: '2026-10-21' });
    expect(older.status).toBe(200);
    expect(older.body.summary).toMatchObject({ visits: 5, people: 4 });
    expect(older.body).not.toHaveProperty('locations');
  });

  test('past 30 days includes the selected date and 29 preceding dates', async () => {
    await client.query(`INSERT INTO visits VALUES (11,6,'2026-09-22',NULL),(12,6,'2026-09-21',NULL)`);
    const month = await get(token(), { date: '2026-10-21', period: 'month' });
    expect(month.body).toMatchObject({ period: 'month', startDate: '2026-09-22', endDate: '2026-10-21' });
    expect(month.body.summary.visits).toBe(9);
  });

  test('trend buckets count distinct patients per bucket for each range', async () => {
    const trend = (query) => request(app).get('/trend').query({ date: '2026-10-21', ...query }).set('Authorization', `Bearer ${token()}`);
    const days = await trend({ range: '7d' });
    expect(days.status).toBe(200);
    expect(days.body.buckets).toHaveLength(7);
    expect(days.body.buckets[0]).toMatchObject({ startDate: '2026-10-15', endDate: '2026-10-15', visits: 1, people: 1, consultedPeople: 1 });
    expect(days.body.buckets[6]).toMatchObject({ startDate: '2026-10-21', visits: 5, people: 4, consultedPeople: 2 });
    expect(Object.keys(days.body.buckets[6].conditions)).toHaveLength(7);
    expect(days.body.buckets[6].conditions.diabetes).toBe(1);
    const weeks = await trend({ range: '12w' });
    expect(weeks.body.buckets).toHaveLength(12);
    expect(weeks.body.buckets[11]).toMatchObject({ startDate: '2026-10-15', endDate: '2026-10-21', visits: 7, people: 5 });
    const months = await trend({ range: '12m' });
    expect(months.body.buckets.map(b => b.startDate)).toEqual(['2025-11-01','2025-12-01','2026-01-01','2026-02-01','2026-03-01','2026-04-01','2026-05-01','2026-06-01','2026-07-01','2026-08-01','2026-09-01','2026-10-01']);
    expect(months.body.buckets[10]).toMatchObject({ endDate: '2026-09-30', visits: 2, people: 1 });
    expect(months.body.buckets[11]).toMatchObject({ endDate: '2026-10-21', visits: 8 });
    expect((await trend({ range: '5y' })).status).toBe(400);
    expect((await request(app).get('/trend').query({ date: '2026-10-21' })).status).toBe(401);
  });

});
