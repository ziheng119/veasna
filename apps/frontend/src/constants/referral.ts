// Places a doctor can refer a patient to: an editable list (Station data page,
// useFormOptions("referral_destinations")). Stored on the referral as newline-separated text.
// Referrals saved earlier keep whatever names they were saved with (e.g. "SEVA").

// Destinations as stored in referral.referral_type (one per line).
export function parseReferralDestinations(referralType: string | null | undefined): string[] {
  return (referralType ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
}
