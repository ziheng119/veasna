// Referral outcomes the partner NGO station can record for a patient. Must match
// apps/backend/routes/visits.js. The stored ids keep their original names.
import { PARTNER_NGO_NAME } from "./partnerNgo";

export const SEVA_REFERRALS = [
  { id: "cataract_surgery", label: "Cataract surgery" },
  { id: "seva_general", label: `${PARTNER_NGO_NAME} (general)` },
] as const;

export type SevaReferral = (typeof SEVA_REFERRALS)[number]["id"];

export function sevaReferralLabel(id?: string | null): string {
  return SEVA_REFERRALS.find((referral) => referral.id === id)?.label ?? "";
}
