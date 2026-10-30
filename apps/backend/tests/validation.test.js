const { toPositiveInt, toCount, isIsoDate } = require('../utils/validation');

describe('Shared input validation', () => {
  test.each([
    [1, 1], ['42', 42], [' 7 ', 7], [2147483647, 2147483647],
    [0, null], [-1, null], [1.5, null], ['5abc', null], ['1e3', null], ['', null],
    [2147483648, null], ['99999999999', null], [null, null], [undefined, null], [{}, null], [true, null],
  ])('toPositiveInt(%p) -> %p', (input, expected) => expect(toPositiveInt(input)).toBe(expected));

  test('toCount accepts zero, otherwise matches toPositiveInt', () => {
    expect(toCount(0)).toBe(0);
    expect(toCount('0')).toBe(0);
    expect(toCount(-3)).toBeNull();
    expect(toCount(1e12)).toBeNull();
  });

  test.each([
    ['2026-10-30', true], ['2024-02-29', true],
    ['2026-02-30', false], ['2025-02-29', false], ['2026-13-01', false], ['30-10-2026', false], ['', false], [20261030, false],
  ])('isIsoDate(%p) -> %p', (input, expected) => expect(isIsoDate(input)).toBe(expected));
});
