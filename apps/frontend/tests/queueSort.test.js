const { sortQueuePatients } = require('../src/lib/queueSort');
const row = (id, queue_no) => ({ visit_id: id, queue_no });

test('arrival mode preserves API order without mutating input', () => {
  const input = Object.freeze([row(8, '2'), row(1, '1')]);
  const result = sortQueuePatients(input, 'arrival');
  expect(result.map(p => p.visit_id)).toEqual([8, 1]); expect(result).not.toBe(input);
});
test('queue numbers sort numerically, followed by case-insensitive suffixes', () => {
  const input = ['10', '2B', '2AA', '2a', '2', '1'].map((n, i) => row(i, n));
  expect(sortQueuePatients(input, 'number').map(p => p.queue_no)).toEqual(['1', '2', '2a', '2AA', '2B', '10']);
  expect(input[0].queue_no).toBe('10');
});
test('equal numbers retain API arrival order; unknown formats follow valid numbers', () => {
  const input = [row(8, '02'), row(7, '2'), row(5, 'unknown'), row(4, '1')];
  expect(sortQueuePatients(input, 'number').map(p => p.visit_id)).toEqual([4, 8, 7, 5]);
});
test('digit comparison does not lose precision', () => {
  expect(sortQueuePatients([row(1, '99999999999999999999'), row(2, '99999999999999999998')], 'number').map(p => p.visit_id)).toEqual([2, 1]);
});
test('queue numbers with letters sort naturally after plain numbers', () => {
  const input = ['A12', '12', 'b1', 'A2', '2A', 'A1', '3'].map((n, i) => row(i, n));
  expect(sortQueuePatients(input, 'number').map(p => p.queue_no)).toEqual(['2A', '3', '12', 'A1', 'A2', 'A12', 'b1']);
});
