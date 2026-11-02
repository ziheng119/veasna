const { queueNoJumpError } = require('../src/lib/queueNumber');
const backend = require('../../backend/utils/queueNumber');

// Next number 14: patients 1-13 have been issued.
const cases = ['14', '1', '9', '13A', '13a', 'A12', '132', '1399', '99', '14A', '20A', ' 132 '];

test('registration refuses the same typed numbers as the server, with the same message', () => {
  for (const value of cases) {
    expect(queueNoJumpError(value, '14')).toBe(backend.queueNoJumpError(backend.normalizeQueueNo(value), '14'));
  }
});

test('"132" typed for "13A" is refused with a suggestion; "13A" and lettered series are allowed', () => {
  expect(queueNoJumpError('132', '14')).toMatch(/ahead of the next number, 14\. To group with patient 13, add a letter, e\.g\. 13A\./);
  expect(queueNoJumpError('13a', '14')).toBeNull();
  expect(queueNoJumpError('A99', '14')).toBeNull();
  expect(queueNoJumpError('20A', '14')).toMatch(/^No patient has number 20 yet/);
});
