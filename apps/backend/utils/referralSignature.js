// A referral's signature is either drawn strokes (points scaled 0..1 to the signature box) or an
// uploaded picture of a signature: { image: "data:image/png;base64,..." }. The app shrinks an
// upload to the signature box before sending it, so it stays small; anything else is refused.

// Longest accepted image data URL, in characters (about 60 KB of picture). Requests are capped at
// 100 KB by the JSON body parser.
const MAX_IMAGE_LENGTH = 90000;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
// The file must really be the type it claims: PNG and JPEG start with these bytes.
const MAGIC = { png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], jpeg: [0xff, 0xd8, 0xff] };

function validStrokes(value) {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 &&
    value.reduce((sum, stroke) => sum + (Array.isArray(stroke) ? stroke.length : 0), 0) <= 2000 &&
    value.every(stroke => Array.isArray(stroke) && stroke.length >= 2 &&
      stroke.every(point => Array.isArray(point) && point.length === 2 &&
        point.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)));
}

function validImage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.keys(value).length !== 1 || typeof value.image !== 'string' || value.image.length > MAX_IMAGE_LENGTH) return false;
  const match = IMAGE_DATA_URL.exec(value.image);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[2], 'base64');
  return MAGIC[match[1]].every((byte, index) => bytes[index] === byte);
}

function validateSignature(value) {
  if (value == null) return true; // Legacy clients and unsigned drafts.
  return Array.isArray(value) ? validStrokes(value) : validImage(value);
}

module.exports = { validateSignature, MAX_IMAGE_LENGTH };
