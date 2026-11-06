const { TB_MIN_RED_FLAGS, TB_STATIONS, meetsTbThreshold, tbThresholdHint } = require('../src/constants/tb');
const backend = require('../../backend/utils/tb');

test('the registration and triage forms use the same red flag threshold as the server', () => {
  expect(TB_MIN_RED_FLAGS).toBe(backend.TB_MIN_RED_FLAGS);
  expect(TB_MIN_RED_FLAGS).toBe(3);
});

test('a TB patient goes only to Consult, on the server and in the registration form', () => {
  expect(TB_STATIONS).toEqual(backend.TB_ROUTE);
  expect(TB_STATIONS).toEqual(['consultation']);
});

test('a patient is flagged only with 3 or more red flags', () => {
  expect(meetsTbThreshold([])).toBe(false);
  expect(meetsTbThreshold(['fever', 'night_sweats'])).toBe(false);
  expect(meetsTbThreshold(['fever', 'night_sweats', 'weight_loss'])).toBe(true);
  expect(tbThresholdHint(2)).toBe('2 of 3 red flags ticked. The patient is flagged for suspected TB only with 3 or more.');
});
