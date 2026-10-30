import { PARTNER_NGO_NAME } from "./partnerNgo";

// Places a doctor can refer a patient to. Stored on the referral as newline-separated text.
// Referrals saved earlier keep whatever names they were saved with (e.g. "SEVA").
export const REFERRAL_DESTINATIONS = [
  "MongKol Borey Hospital",
  "Poipett Referral Hospital",
  PARTNER_NGO_NAME,
  "Optometrist",
  "Dentist",
  "Bong Bondol",
] as const;

// Destinations as stored in referral.referral_type (one per line).
export function parseReferralDestinations(referralType: string | null | undefined): string[] {
  return (referralType ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
}
