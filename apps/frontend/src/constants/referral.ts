// Places a doctor can refer a patient to outside the screening, on referral days: an editable list
// (Station data page, useFormOptions("referral_destinations")), by default Preah Ang Duong
// Hospital and Samdech Ov Referral Hospital. Physiotherapy is referred within the screening from
// the Consult page instead, and an optician at Triage ("Refer to optician"). Stored on the referral as newline-separated text.
// Referrals saved earlier keep whatever names they were saved with (e.g. "SEVA").

// Destinations as stored in referral.referral_type (one per line).
export function parseReferralDestinations(referralType: string | null | undefined): string[] {
  return (referralType ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
}
