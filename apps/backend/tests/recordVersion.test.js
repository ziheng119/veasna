// Saves to the same record take turns (utils/recordVersion.js). The database is a stub.
const { EventEmitter } = require('events');
const { rejectChangedRecord } = require('../utils/recordVersion');

const fakeRes = () => {
  const res = new EventEmitter();
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => { res.writableFinished = true; res.emit('finish'); return res; });
  return res;
};
const db = (version) => ({ query: jest.fn(async () => ({ rows: version ? [{ last_updated_at: new Date(version) }] : [] })) });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('a second save to the same record waits until the first has answered', async () => {
  const first = fakeRes();
  const second = fakeRes();
  expect(await rejectChangedRecord(db(null), first, 'dental', 7, null)).toBe(false);
  let secondChecked = false;
  const waiting = rejectChangedRecord(db(null), second, 'dental', 7, null).then((r) => { secondChecked = true; return r; });
  await tick();
  expect(secondChecked).toBe(false);
  first.emit('finish');
  expect(await waiting).toBe(false);
  second.emit('finish');
});

test('other records do not wait', async () => {
  const held = fakeRes();
  await rejectChangedRecord(db(null), held, 'dental', 8, null);
  expect(await rejectChangedRecord(db(null), fakeRes(), 'dental', 9, null)).toBe(false);
  expect(await rejectChangedRecord(db(null), fakeRes(), 'seva', 8, null)).toBe(false);
  held.emit('finish');
});

test('a refused save frees the record', async () => {
  const stale = fakeRes();
  expect(await rejectChangedRecord(db('2026-11-11T08:00:00.000Z'), stale, 'history', 3, null)).toBe(true);
  expect(stale.status).toHaveBeenCalledWith(409);
  const bad = fakeRes();
  expect(await rejectChangedRecord(db(null), bad, 'history', 3, 'yesterday')).toBe(true);
  expect(bad.status).toHaveBeenCalledWith(400);
  expect(await rejectChangedRecord(db(null), fakeRes(), 'history', 3, undefined)).toBe(false);
});

test('a device that disconnects frees the record', async () => {
  const gone = fakeRes();
  await rejectChangedRecord(db(null), gone, 'referral', 4, null);
  gone.emit('close');
  expect(await rejectChangedRecord(db(null), fakeRes(), 'referral', 4, null)).toBe(false);
});
