// Referral outcomes Seva can record for a patient. Must match apps/backend/routes/visits.js.
export const SEVA_REFERRALS = [
  { id: "cataract_surgery", label: "Cataract surgery" },
  { id: "seva_general", label: "SEVA (general)" },
] as const;

export type SevaReferral = (typeof SEVA_REFERRALS)[number]["id"];

export function sevaReferralLabel(id?: string | null): string {
  return SEVA_REFERRALS.find((referral) => referral.id === id)?.label ?? "";
}
