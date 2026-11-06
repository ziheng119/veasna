// Registration fields accept only valid characters as the user types (lib/inputFormats.ts,
// components/shared/FilteredInput.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/components/ui/input', () => ({ Input: props => require('react').createElement('input', props) }));
const { matchesFormat } = require('../src/lib/inputFormats');
const FilteredInput = require('../src/components/shared/FilteredInput').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test.each([
  ['measurement', ['', '1', '152', '152.', '152.5', '.5'], ['abc', '1e3', '-5', '152.55', '1520', '15,2', '1.2.3']],
  ['temperature', ['', '36', '36.8'], ['368', '36.85', '3a']],
  ['wholeNumber', ['', '0', '120'], ['1.5', '1200', '12a', '-1']],
  ['phone', ['', '+855 12 345-678'], ['012abc', '(012)']],
])('%s accepts valid text and refuses the rest', (format, valid, invalid) => {
  for (const value of valid) expect([value, matchesFormat(value, format)]).toEqual([value, true]);
  for (const value of invalid) expect([value, matchesFormat(value, format)]).toEqual([value, false]);
});

test('typing a letter into a number field changes nothing; digits go through', async () => {
  const onValueChange = jest.fn();
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(FilteredInput, { format: 'measurement', value: '15', onValueChange }));
  });
  const input = renderer.root.findByType('input');
  expect(input.props).toMatchObject({ type: 'text', inputMode: 'decimal' });
  input.props.onChange({ target: { value: '15a' } });
  expect(onValueChange).not.toHaveBeenCalled();
  input.props.onChange({ target: { value: '152' } });
  expect(onValueChange).toHaveBeenCalledWith('152');
});
