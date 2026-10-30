const { toPositiveInt, toCount, isIsoDate, localDate } = require('../utils/validation');

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

describe('Clinic day uses the host time zone, not UTC', () => {
  const originalTz = process.env.TZ;
  afterEach(() => { process.env.TZ = originalTz; });

  test('06:30 in Phnom Penh is already the new day (UTC is still the previous day)', () => {
    process.env.TZ = 'Asia/Phnom_Penh';
    const sixThirtyLocal = new Date('2026-10-30T23:30:00Z'); // 06:30 on 31 Oct, UTC+7
    expect(sixThirtyLocal.toISOString().slice(0, 10)).toBe('2026-10-30');
    expect(localDate(sixThirtyLocal)).toBe('2026-10-31');
  });

  test('the queue date does not change at 07:00 local time', () => {
    process.env.TZ = 'Asia/Phnom_Penh';
    const before = localDate(new Date('2026-10-30T23:59:00Z')); // 06:59 local
    const after = localDate(new Date('2026-10-31T00:01:00Z'));  // 07:01 local
    expect(before).toBe(after);
  });
});
