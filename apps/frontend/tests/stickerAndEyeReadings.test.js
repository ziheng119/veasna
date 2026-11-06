// Registration sticker colours on queue cards, and the order of the Snellen readings.
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../src/components/shared/PageCard', () => ({ PageCard: ({ children }) => React.createElement('section', null, children) }));
jest.mock('../src/components/ui/badge', () => ({ Badge: ({ children }) => React.createElement('span', null, children) }));
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => React.createElement('input', props) }));
const { PatientQueue } = require('../src/components/home/PatientQueue');
const { findSticker } = require('../src/components/shared/StickerTag');
const { EYE_READING_FIELDS, REQUIRED_EYE_READING_FIELDS } = require('../src/components/shared/EyeReadingsGrid');
const { DEFAULT_FORM_OPTIONS } = require('../src/stores/useFormOptionsStore');
global.IS_REACT_ACT_ENVIRONMENT = true;

test('readings go without pinhole, with pinhole, then with glasses, which is optional', () => {
  expect(EYE_READING_FIELDS).toEqual([
    'left_without_pinhole', 'right_without_pinhole', 'left_with_pinhole', 'right_with_pinhole', 'left_with_glasses', 'right_with_glasses',
  ]);
  expect(REQUIRED_EYE_READING_FIELDS).toEqual(['left_without_pinhole', 'right_without_pinhole', 'left_with_pinhole', 'right_with_pinhole']);
  expect(DEFAULT_FORM_OPTIONS.snellen.map(option => option.label)).toEqual(
    ['20/20', '20/25', '20/30', '20/40', '20/50', '20/60', '20/70', '20/100', '20/200']);
});

test('a sticker is looked up by id; one removed from the list still shows, in grey', () => {
  const colours = DEFAULT_FORM_OPTIONS.sticker_colours;
  expect(colours).toHaveLength(15);
  expect(findSticker(colours, 'light_blue')).toEqual({ label: 'Light blue', colour: '#8ccbf2' });
  expect(findSticker(colours, 'tartan_plaid')).toEqual({ label: 'tartan plaid', colour: '#9ca3af' });
  expect(findSticker(colours, null)).toBeNull();
});

test('the queue card shows the sticker colour beside the number and says it to screen readers', async () => {
  global.localStorage = { getItem: () => null, setItem: () => {} }; global.window = new EventTarget();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let renderer;
  try {
    await act(async () => {
      renderer = create(React.createElement(PatientQueue, { patients: [
        { visit_id: 1, queue_no: '4', english_name: 'Alice', timestamp: '08:00 AM', sticker_colour: 'gold' },
        { visit_id: 2, queue_no: '5', english_name: 'Bob', timestamp: '08:05 AM' },
      ] }));
    });
    const tags = renderer.root.findAll(node => node.type === 'span' && node.props['data-sticker']);
    expect(tags).toHaveLength(1);
    expect(tags[0].props.title).toBe('Gold sticker');
    expect(tags[0].props.style.backgroundColor).toBe('#d4af37');
    const labels = renderer.root.findAllByType('button').map(button => button.props['aria-label']).filter(Boolean);
    expect(labels[0]).toBe('Open Alice, queue 4, gold sticker');
    expect(labels[1]).toBe('Open Bob, queue 5');
  } finally {
    renderer?.unmount();
    log.mockRestore();
  }
});
