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

describe('uploaded signature pictures', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString('base64');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]).toString('base64');
  const { MAX_IMAGE_LENGTH } = require('../utils/referralSignature');

  test('accepts a PNG or JPEG data URL', () => {
    expect(validateSignature({ image: `data:image/png;base64,${png}` })).toBe(true);
    expect(validateSignature({ image: `data:image/jpeg;base64,${jpeg}` })).toBe(true);
  });

  test.each([
    ['SVG, which can carry scripts', { image: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}` }],
    ['a GIF', { image: `data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}` }],
    ['a file that is not what it claims', { image: `data:image/png;base64,${jpeg}` }],
    ['text, not base64', { image: 'data:image/png;base64,<script>' }],
    ['a web link', { image: 'http://example.com/signature.png' }],
    ['extra fields', { image: `data:image/png;base64,${png}`, onload: 'x' }],
    ['no picture', {}],
    ['a number', { image: 5 }],
  ])('refuses %s', (_, value) => {
    expect(validateSignature(value)).toBe(false);
  });

  test('refuses a picture too large to be a shrunk signature', () => {
    const big = `data:image/png;base64,${png}${'A'.repeat(MAX_IMAGE_LENGTH)}`;
    expect(validateSignature({ image: big })).toBe(false);
  });
});
