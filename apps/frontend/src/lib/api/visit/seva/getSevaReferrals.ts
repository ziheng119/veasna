import { backend_url } from "@/constants/env_variable";
import { SevaReferral } from "@/constants/sevaReferral";

export interface SevaReferralRow {
  visit_id: number;
  patient_id: number;
  referral: SevaReferral;
  diagnosis: string;
  date_of_referral: string | null;
  visit_date: string;
  queue_no: string;
  english_name: string | null;
  khmer_name: string | null;
  date_of_birth: string | null;
  sex: "M" | "F" | null;
  phone_number: string | null;
  face_id: string | null;
}

// Patients at a location that Seva has marked for referral, newest visit first.
export async function getSevaReferrals(locationId: number, token: string): Promise<SevaReferralRow[]> {
  const res = await fetch(`${backend_url}/api/visits/seva-referrals?location_id=${locationId}`, {
    cache: "no-cache",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch SEVA referrals: ${res.status}`);
  }
  return res.json();
}
