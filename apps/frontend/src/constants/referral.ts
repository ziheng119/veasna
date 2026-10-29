// Places a doctor can refer a patient to. Stored on the referral as newline-separated text.
export const REFERRAL_DESTINATIONS = [
  "MongKol Borey Hospital",
  "Poipett Referral Hospital",
  "SEVA",
  "Optometrist",
  "Dentist",
  "Bong Bondol",
] as const;

// Destinations as stored in referral.referral_type (one per line).
export function parseReferralDestinations(referralType: string | null | undefined): string[] {
  return (referralType ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
}
