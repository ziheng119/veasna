const express = require('express');
const { createServer } = require('http');
const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { attachRealtime, notifyListChanges } = require('../realtime');

jest.mock('../config/db', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));
const db = require('../config/db');
const secret = 'isolated-realtime-test-secret';
const origin = 'http://192.168.1.10:3001';
const token = (id = 1, expiresIn = '1h') => jwt.sign({ id, role: 'admin' }, secret, { expiresIn });
const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Timed out: ${name}`)); }, 3000);
  function receive(...args) { clearTimeout(timer); resolve(args); }
  socket.once(name, receive);
});

// Actual HTTP routes and Socket.IO transport; database is isolated from clinic data.
describe('Live list notifications', () => {
  let app, server, io, url, sockets, originalSecret;
  beforeEach(async () => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    sockets = [];
    app = express();
    app.use(express.json());
    server = createServer(app);
    io = attachRealtime(server, { origins: [origin], secret });
    app.use('/api', notifyListChanges(io));
    app.use('/api/queue', require('../routes/queue'));
    app.use('/api/registration', require('../routes/registration'));
    app.use('/api/patient', require('../routes/patient'));
    app.use('/api/visits', require('../routes/visits'));
    app.get('/api/patients', (req, res) => res.json([]));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => {
    sockets.forEach(socket => socket.disconnect());
    await new Promise(resolve => io.close(resolve));
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });
  function client(auth = token(), options = {}) {
    const socket = connect(url, {
      autoConnect: false, forceNew: true, transports: ['websocket'],
      auth: { token: auth }, extraHeaders: { Origin: origin }, ...options,
    });
    sockets.push(socket);
    return socket;
  }
  async function ready(socket) { const connected = event(socket, 'connect'); socket.connect(); await connected; }

  test('committed station movement notifies two users, without patient data', async () => {
    let committed = false;
    const transaction = { release: jest.fn(), query: jest.fn(async sql => {
      if (sql === 'COMMIT') committed = true;
      if (sql.includes('FROM visits')) return { rows: [{ id: 1, completed_at: null }] };
      if (sql.includes('SELECT id, station')) return { rows: [{ id: 1, station: 'triage' }, { id: 2, station: 'seva' }] };
      return { rows: [] };
    }) };
    db.pool.connect.mockResolvedValue(transaction);
    const a = client(token(1)), b = client(token(2));
    await Promise.all([ready(a), ready(b)]);
    const notifications = Promise.all([event(a, 'lists:changed'), event(b, 'lists:changed')]);
    const response = await request(app).post('/api/queue/1/stations/triage/complete')
      .set('Authorization', `Bearer ${token()}`).send({});
    expect(response.status).toBe(200);
    expect(response.body.next_station).toBe('seva');
    expect(await notifications).toEqual([[], []]);
    expect(committed).toBe(true);
    expect(transaction.release).toHaveBeenCalled();
  });

  test('new registration notifies observers only after commit', async () => {
    let committed = false;
    const transaction = { release: jest.fn(), query: jest.fn(async sql => {
      if (sql === 'COMMIT') committed = true;
      if (sql.includes('INSERT INTO patients')) return { rows: [{ id: 8 }] };
      if (sql.includes('INSERT INTO visits')) return { rows: [{ id: 9, created_at: new Date() }] };
      return { rows: [] };
    }) };
    db.pool.connect.mockResolvedValue(transaction);
    const observer = client(); await ready(observer);
    let committedWhenNotified = false;
    observer.once('lists:changed', () => { committedWhenNotified = committed; });
    const changed = event(observer, 'lists:changed');
    const response = await request(app).post('/api/visits').set('Authorization', `Bearer ${token()}`).send({
      patientInfo: { english_name: 'Test Only', location_id: 1, sex: 'F' },
      visit: { queue_no: '9' }, stations: ['triage'], hef: {},
      vitals: { height: 160, weight: 50, bmi: 19.5, bp_systolic: 110, bp_diastolic: 70, temperature: 37, below_3rd_percentile: false },
    });
    expect(response.status).toBe(201); await changed;
    expect(committedWhenNotified).toBe(true);
  });

  test('HTTP polling fallback also receives updates', async () => {
    const observer = client(token(), { transports: ['polling'] }); await ready(observer);
    db.query.mockResolvedValue({ rows: [{ id: 5 }] });
    const changed = event(observer, 'lists:changed');
    await request(app).delete('/api/registration/5').set('Authorization', `Bearer ${token()}`);
    await changed;
  });

  test('a route edit notifies another user after commit', async () => {
    let committed = false;
    const transaction = { release: jest.fn(), query: jest.fn(async sql => {
      if (sql === 'COMMIT') committed = true;
      if (sql.includes('FROM visits')) return { rows: [{ id: 1, completed_at: null }] };
      if (sql.includes('SELECT * FROM visit_stations')) return { rows: [
        { station: 'triage', completed_at: '2026-10-20T01:00:00Z' },
        { station: 'seva', completed_at: null },
      ] };
      return { rows: [] };
    }) };
    db.pool.connect.mockResolvedValue(transaction);
    const observer = client(); await ready(observer);
    const changed = event(observer, 'lists:changed');
    const response = await request(app).put('/api/queue/1/stations').set('Authorization', `Bearer ${token()}`).send({
      stations: ['triage', 'seva'], ordered: true,
      expected_stations: [{ station: 'triage', completed: true }, { station: 'seva', completed: false }],
    });
    expect(response.status).toBe(200); await changed;
    expect(committed).toBe(true);
    expect(response.body.current_station).toBe('triage');
  });

  test('patient deletion notifies other users', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 5 }] });
    const observer = client(); await ready(observer);
    const changed = event(observer, 'lists:changed');
    const response = await request(app).delete('/api/registration/5').set('Authorization', `Bearer ${token()}`);
    expect(response.status).toBe(200);
    await changed;
  });

  test('patient edits notify both queue and patient-list consumers', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 5, english_name: 'Updated Test' }] });
    const observer = client(); await ready(observer);
    const changed = event(observer, 'lists:changed');
    const response = await request(app).put('/api/patient/5').set('Authorization', `Bearer ${token()}`)
      .send({ english_name: 'Updated Test', date_of_birth: '2000-01-01', sex: 'F' });
    expect(response.status).toBe(200); await changed;
  });

  test('a rolled-back station change does not broadcast', async () => {
    const transaction = { release: jest.fn(), query: jest.fn(async sql => {
      if (sql.includes('FROM visits')) return { rows: [{ id: 1, completed_at: null }] };
      return { rows: [] };
    }) };
    db.pool.connect.mockResolvedValue(transaction);
    const observer = client(); await ready(observer);
    const received = jest.fn(); observer.on('lists:changed', received);
    const response = await request(app).post('/api/queue/1/stations/triage/complete')
      .set('Authorization', `Bearer ${token()}`).send({});
    expect(response.status).toBe(409);
    expect(transaction.query).toHaveBeenCalledWith('ROLLBACK');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(received).not.toHaveBeenCalled();
  });

  test('failed writes, reads and spoofed client messages do not broadcast', async () => {
    const a = client(), b = client(token(2)); await Promise.all([ready(a), ready(b)]);
    const received = jest.fn(); b.on('lists:changed', received);
    a.emit('lists:changed');
    expect((await request(app).post('/api/queue/invalid/stations/triage/complete')
      .set('Authorization', `Bearer ${token()}`).send({})).status).toBe(400);
    expect((await request(app).delete('/api/registration/5')).status).toBe(401);
    db.query.mockResolvedValue({ rows: [] });
    expect((await request(app).delete('/api/registration/5').set('Authorization', `Bearer ${token()}`)).status).toBe(404);
    await request(app).get('/api/patients');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(received).not.toHaveBeenCalled();
  });

  test.each([undefined, 'invalid', token(1, '-1s')])('rejects missing, invalid or expired authentication: %s', async auth => {
    const socket = client(auth === undefined ? null : auth, { reconnection: false });
    const failed = event(socket, 'connect_error'); socket.connect();
    expect((await failed)[0].message).toBe('Authentication required');
    expect(io.sockets.sockets.size).toBe(0);
  });

  test('rejects an unapproved browser origin', async () => {
    const socket = client(token(), { extraHeaders: { Origin: 'http://unapproved.test' }, reconnection: false });
    const failed = event(socket, 'connect_error'); socket.connect(); await failed;
    expect(io.sockets.sockets.size).toBe(0);
  });

  test('reconnects after transport loss and receives subsequent updates', async () => {
    const socket = client(token(), { reconnectionDelay: 10, reconnectionDelayMax: 20 }); await ready(socket);
    const reconnected = event(socket, 'connect');
    socket.io.engine.close();
    await reconnected;
    db.query.mockResolvedValue({ rows: [{ id: 5 }] });
    const changed = event(socket, 'lists:changed');
    await request(app).delete('/api/registration/5').set('Authorization', `Bearer ${token()}`);
    await changed;
  });

  test('disconnects a session when its token expires', async () => {
    const socket = client(token(1, '2s')); await ready(socket);
    const disconnected = event(socket, 'disconnect');
    expect((await disconnected)[0]).toBe('io server disconnect');
  });
});
