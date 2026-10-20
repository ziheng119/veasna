// Store bounded vector coordinates, never client-provided SVG/HTML or remote images.
function validateSignature(value) {
  if (value == null) return true; // Legacy clients and unsigned drafts.
  return Array.isArray(value) && value.length > 0 && value.length <= 100 &&
    value.reduce((sum, stroke) => sum + (Array.isArray(stroke) ? stroke.length : 0), 0) <= 2000 &&
    value.every(stroke => Array.isArray(stroke) && stroke.length >= 2 &&
      stroke.every(point => Array.isArray(point) && point.length === 2 &&
        point.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)));
}
module.exports = { validateSignature };
