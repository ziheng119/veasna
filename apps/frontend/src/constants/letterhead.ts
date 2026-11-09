// Letterhead for printed documents such as referral letters.
export const LETTERHEAD = {
  organisation: "Project Battambang",
  subtitle: "Community health screening",
  // The Project Battambang butterfly, apps/frontend/public/btb-logo.png (cropped to the artwork on
  // white; it prints about 22 mm tall). Served by the host, so it prints offline.
  // Letters still print, with the name only, if the file is missing.
  logoPath: "/btb-logo.png",
} as const;

// Absolute URL, because print documents are written into a blank pop-up window.
export function letterheadLogoUrl(): string | undefined {
  if (typeof window === "undefined" || !window.location?.origin) return undefined;
  return `${window.location.origin}${LETTERHEAD.logoPath}`;
}
