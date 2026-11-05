// Checking an uploaded signature picture before it is used (lib/signatureUpload.ts), and showing it
// (components/doctors-consultation/SignaturePad.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
const { sniffImageType, signatureFileError, hasInk, MAX_SIGNATURE_FILE_BYTES } = require('../src/lib/signatureUpload');
global.IS_REACT_ACT_ENVIRONMENT = true;

const bytes = values => Uint8Array.from([...values, ...new Array(16).fill(0)].slice(0, 16));
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = bytes([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

test('files are recognised by their contents, not their name', () => {
  expect(sniffImageType(PNG)).toBe('image/png');
  expect(sniffImageType(JPEG)).toBe('image/jpeg');
  expect(sniffImageType(WEBP)).toBe('image/webp');
  // A RIFF file that isn't WebP (e.g. a WAV sound), a PDF and an SVG are refused.
  expect(sniffImageType(bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  expect(sniffImageType(bytes([...Buffer.from('%PDF-1.7')]))).toBeNull();
  expect(sniffImageType(bytes([...Buffer.from('<svg xmlns=')]))).toBeNull();
});

test('empty, oversized and non-picture files get a clear message', () => {
  expect(signatureFileError({ size: 0 }, PNG)).toBe('That file is empty.');
  expect(signatureFileError({ size: MAX_SIGNATURE_FILE_BYTES + 1 }, PNG)).toMatch(/under 5 MB/);
  expect(signatureFileError({ size: 100 }, bytes([...Buffer.from('%PDF')]))).toMatch(/PNG, JPEG or WebP/);
  expect(signatureFileError({ size: 100 }, JPEG)).toBeNull();
});

test('a blank or see-through picture has no ink; a dark mark does', () => {
  const pixels = (...rgba) => Uint8ClampedArray.from(rgba);
  expect(hasInk(pixels(255, 255, 255, 255, 250, 250, 250, 255))).toBe(false);
  expect(hasInk(pixels(0, 0, 0, 0))).toBe(false);
  expect(hasInk(pixels(255, 255, 255, 255, 20, 20, 60, 255))).toBe(true);
});

test('an uploaded signature shows as a picture and can\'t be drawn over until cleared', async () => {
  const SignaturePad = require('../src/components/doctors-consultation/SignaturePad').default;
  const onChange = jest.fn();
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(SignaturePad, { value: { image: 'data:image/png;base64,iVBORw0KGgo=' }, onChange }));
  });
  expect(renderer.root.findByType('img').props.src).toBe('data:image/png;base64,iVBORw0KGgo=');
  const box = renderer.root.findByProps({ 'aria-label': 'Uploaded signature' });
  box.props.onPointerDown({ isPrimary: true, button: 0 });
  expect(onChange).not.toHaveBeenCalled();
  expect(renderer.root.findByProps({ type: 'file' }).props.accept).toBe('image/png,image/jpeg,image/webp');
  await act(async () => renderer.unmount());
});
