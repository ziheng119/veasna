const { validateSignature } = require('../utils/referralSignature');
test('accepts legacy drafts and bounded signature strokes', () => {
  expect(validateSignature(undefined)).toBe(true);
  expect(validateSignature(null)).toBe(true);
  expect(validateSignature([[[0, 0], [1, 1]]])).toBe(true);
});
test.each(['<svg/>', [], [[]], [[[0, 0]]], [[[0, 0], [Infinity, 1]]], [[[0, 0], [-1, 1]]], [[[0, 0], [2, 1]]], [[[0, 0], ['1', 1]]]])('rejects malformed signature %j', value => {
  expect(validateSignature(value)).toBe(false);
});
test('rejects oversized signatures', () => {
  expect(validateSignature([Array.from({ length: 2001 }, () => [0, 0])])).toBe(false);
  expect(validateSignature(Array.from({ length: 101 }, () => [[0, 0], [1, 1]]))).toBe(false);
});
