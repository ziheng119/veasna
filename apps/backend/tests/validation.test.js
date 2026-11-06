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

describe('queue numbers', () => {
  const { normalizeQueueNo, isValidQueueNo } = require('../utils/queueNumber');
  test.each(['1', '12', '12A', 'A12', 'b3c', ' 7 '])('%j is accepted', value => {
    expect(isValidQueueNo(normalizeQueueNo(value))).toBe(true);
  });
  test.each(['', 'A', 'A-12', '12 A', '12345678901'])('%j is rejected', value => {
    expect(isValidQueueNo(normalizeQueueNo(value))).toBe(false);
  });
  test('stored upper-case', () => expect(normalizeQueueNo(' a12 ')).toBe('A12'));
});

describe('corrected queue numbers may not run ahead of the sequence', () => {
  const { queueNoJumpError } = require('../utils/queueNumber');
  // Next number 14: patients 1-13 have been issued.
  test.each(['14', '1', '9', '13A', '1B', 'A12', 'A999', 'B3C'])('%s is allowed when the next number is 14', value => {
    expect(queueNoJumpError(value, '14')).toBeNull();
  });
  test('a mistyped suffix ("132" for "13A") is refused with a suggestion', () => {
    expect(queueNoJumpError('132', '14')).toBe(
      'Queue number 132 is ahead of the next number, 14. To group with patient 13, add a letter, e.g. 13A.');
  });
  test('the suggestion uses the longest issued leading part', () => {
    expect(queueNoJumpError('1399', '14')).toMatch(/e\.g\. 13A/);
    expect(queueNoJumpError('99', '14')).toMatch(/e\.g\. 9A/);
    expect(queueNoJumpError('5', '1')).toBe('Queue number 5 is ahead of the next number, 1.');
  });
  test.each(['14A', '20A', '1A'])('a suffix of a number not yet issued (%s) is refused', value => {
    const next = value === '1A' ? '1' : '14';
    expect(queueNoJumpError(value, next)).toMatch(/^No patient has number \d+ yet/);
  });
});
