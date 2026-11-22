// The draggable line between the queue and the open patient (components/shared/SplitDivider.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
const SplitDivider = require('../src/components/shared/SplitDivider').default;
const { DEFAULT_QUEUE_SHARE } = require('../src/components/shared/SplitDivider');
global.IS_REACT_ACT_ENVIRONMENT = true;

// A 1000px-wide surface.
const gridRef = { current: { getBoundingClientRect: () => ({ left: 0, width: 1000 }), dataset: {} } };
const render = async (share = 40) => {
  const onChange = jest.fn(), onCommit = jest.fn();
  let renderer;
  await act(async () => { renderer = create(React.createElement(SplitDivider, { gridRef, share, onChange, onCommit })); });
  return { separator: renderer.root.findByProps({ role: 'separator' }), onChange, onCommit };
};
const key = (separator, k, shiftKey = false) => act(async () => separator.props.onKeyDown({ key: k, shiftKey, preventDefault() {} }));

test('arrow keys move the line, Shift further; Home and End stop at each column\'s minimum width', async () => {
  const { separator, onCommit } = await render(40);
  expect(separator.props['aria-valuenow']).toBe(40);
  await key(separator, 'ArrowRight');
  expect(onCommit).toHaveBeenLastCalledWith(42);
  await key(separator, 'ArrowLeft', true);
  expect(onCommit).toHaveBeenLastCalledWith(30);
  await key(separator, 'Home');
  expect(onCommit).toHaveBeenLastCalledWith(25.6); // the queue's 256px
  await key(separator, 'End');
  expect(onCommit).toHaveBeenLastCalledWith(55.2); // leaving the patient 448px
  onCommit.mockClear();
  await key(separator, 'Tab');
  expect(onCommit).not.toHaveBeenCalled();
});

test('dragging follows the pointer without the columns gliding, and a double-click resets', async () => {
  const { separator, onChange, onCommit } = await render(40);
  const pointer = clientX => ({ button: 0, clientX, pointerId: 1, preventDefault() {}, currentTarget: { setPointerCapture() {}, releasePointerCapture() {} } });
  await act(async () => separator.props.onPointerDown(pointer(400)));
  expect('resizing' in gridRef.current.dataset).toBe(true);
  await act(async () => separator.props.onPointerMove(pointer(300)));
  expect(onChange).toHaveBeenLastCalledWith(30);
  await act(async () => separator.props.onPointerMove(pointer(50)));
  expect(onChange).toHaveBeenLastCalledWith(25.6);
  await act(async () => separator.props.onPointerUp(pointer(50)));
  expect('resizing' in gridRef.current.dataset).toBe(false);
  expect(onCommit).toHaveBeenCalledTimes(1);
  await act(async () => separator.props.onDoubleClick());
  expect(onCommit).toHaveBeenLastCalledWith(DEFAULT_QUEUE_SHARE);
});
