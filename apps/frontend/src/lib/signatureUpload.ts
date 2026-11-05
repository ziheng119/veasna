// Turning an uploaded signature file into a small picture for the referral (apps/backend/utils/
// referralSignature.js checks it again). The file is checked, then redrawn onto the signature box
// (600 x 180), which also strips anything but the picture itself.

import { SignatureUpload } from "@/lib/types/consultation";

export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 180;
export const MAX_SIGNATURE_FILE_BYTES = 5 * 1024 * 1024;
// Must stay under MAX_IMAGE_LENGTH in apps/backend/utils/referralSignature.js.
export const MAX_SIGNATURE_DATA_LENGTH = 80000;
export const SIGNATURE_FILE_TYPES = "image/png,image/jpeg,image/webp";

// File types by their first bytes, so a renamed file can't pass as a picture.
const SIGNATURES: [string, number[]][] = [
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/webp", [0x52, 0x49, 0x46, 0x46]], // "RIFF", then "WEBP" at byte 8
];

export function sniffImageType(bytes: Uint8Array): string | null {
  for (const [type, magic] of SIGNATURES) {
    if (!magic.every((byte, index) => bytes[index] === byte)) continue;
    if (type === "image/webp" && String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") continue;
    return type;
  }
  return null;
}

// Problems with the file before it is opened: its size and what it really is. null when fine.
export function signatureFileError(file: { size: number }, bytes: Uint8Array): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_SIGNATURE_FILE_BYTES) return "That file is too big. Use a picture under 5 MB.";
  if (!sniffImageType(bytes)) return "Use a PNG, JPEG or WebP picture of the signature.";
  return null;
}

// Whether the picture has any ink: some pixel clearly darker than paper and not see-through.
export function hasInk(pixels: Uint8ClampedArray): boolean {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    const lightness = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
    if (alpha > 64 && lightness < 160) return true;
  }
  return false;
}

// Reads, checks and shrinks the file. Resolves to the signature, or rejects with a message to show.
export async function readSignatureFile(file: File): Promise<SignatureUpload> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const problem = signatureFileError(file, bytes);
  if (problem) throw new Error(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That picture couldn't be opened. Try saving it again as PNG or JPEG.");
  }
  if (bitmap.width < 20 || bitmap.height < 10) throw new Error("That picture is too small to read. Use a larger one.");

  const canvas = document.createElement("canvas");
  canvas.width = SIGNATURE_WIDTH;
  canvas.height = SIGNATURE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't prepare pictures. Draw the signature instead.");
  // Fit the whole picture in the box, keeping its shape, on white paper.
  const scale = Math.min(SIGNATURE_WIDTH / bitmap.width, SIGNATURE_HEIGHT / bitmap.height, 1);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
  context.drawImage(bitmap, (SIGNATURE_WIDTH - width) / 2, (SIGNATURE_HEIGHT - height) / 2, width, height);
  bitmap.close?.();

  if (!hasInk(context.getImageData(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT).data)) {
    throw new Error("No signature can be seen in that picture. Use a dark signature on a light background.");
  }
  // PNG keeps lines sharp; a busy photo is saved as JPEG instead to stay small.
  for (const [type, quality] of [["image/png", undefined], ["image/jpeg", 0.85], ["image/jpeg", 0.6]] as const) {
    const image = canvas.toDataURL(type, quality);
    if (image.length <= MAX_SIGNATURE_DATA_LENGTH) return { image };
  }
  throw new Error("That picture has too much detail. Crop it to just the signature and try again.");
}
