// Unique ID (stored as face_id): first 3 characters of the English name + first 3 of the Khmer name + date of birth
// (DDMMYYYY), upper-cased with spaces removed. A missing part is left out.
// The server generates the stored value with the same rule (see migration 007); this is the preview.
export function generateFaceId(englishName?: string | null, khmerName?: string | null, dateOfBirth?: string | null): string {
  // Array.from keeps multi-unit characters whole, matching how the database counts characters.
  const firstThree = (name?: string | null) => Array.from((name ?? "").replace(/\s/g, "")).slice(0, 3).join("");
  const dob = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth ?? "");
  const datePart = dob ? `${dob[3]}${dob[2]}${dob[1]}` : "";
  return (firstThree(englishName) + firstThree(khmerName)).toUpperCase() + datePart;
}
