import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import type { PrintableReferral } from "@/components/doctors-consultation/ReferralDocument";
import type { Signature } from "@/lib/types/consultation";
import type { PatientInfo } from "@/lib/types/patient";

interface DailyReferralRow {
  visit_id: number;
  patient_id: number;
  english_name?: string;
  khmer_name?: string;
  sex: PatientInfo["sex"];
  address: string | null;
  date_of_birth: string | null;
  referral_date: string | null;
  referral_type: string;
  illness: string;
  duration: string;
  reason: string;
  signature: Signature | null;
  signer_name: string | null;
  signer_id: number | null;
  signed_at: string | null;
}

export async function getDailyReferrals(locationId: number, date: string): Promise<PrintableReferral[]> {
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");
  const params = new URLSearchParams({ location_id: String(locationId), date });
  const response = await fetch(`${backend_url}/api/visits/referrals?${params}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load today's referrals. Please try again.");
  const rows: DailyReferralRow[] = await response.json();
  return rows.map(row => ({
    visitId: row.visit_id,
    patient: {
      id: row.patient_id, location_id: locationId, face_id: null, lastUpdated: "",
      english_name: row.english_name, khmer_name: row.khmer_name, sex: row.sex,
      address: row.address, date_of_birth: row.date_of_birth ?? "",
    },
    referral: {
      referralDate: row.referral_date ?? "",
      referralType: (row.referral_type ?? "").split("\n").map(value => value.trim()).filter(Boolean),
      illness: row.illness ?? "", duration: row.duration ?? "", reason: row.reason ?? "",
      signature: row.signature, signerName: row.signer_name, signerId: row.signer_id, signedAt: row.signed_at,
    },
  }));
}
