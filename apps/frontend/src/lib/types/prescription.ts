export type PrescriptionStatus = "pending" | "dispensed" | "cancelled";

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  pending: "Waiting at pharmacy",
  dispensed: "Dispensed",
  cancelled: "Cancelled",
};

export interface Prescription {
  id: number;
  visit_id: number;
  drug_id: number | null;
  drug_name: string;
  quantity: number;
  instructions: string;
  status: PrescriptionStatus;
  prescribed_at: string;
  prescribed_by: string | null;
  dispensed_at: string | null;
  dispensed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  patient_id: number;
  queue_no: string;
  visit_date: string;
  location_id: number;
  english_name: string | null;
  khmer_name: string | null;
}

// A patient with prescriptions at a location, for the Pharmacy patient list.
export interface PrescriptionPatient {
  patient_id: number;
  english_name: string | null;
  khmer_name: string | null;
  face_id: string | null;
  pending_count: number;
  dispensed_count: number;
  cancelled_count: number;
  last_prescribed_at: string;
}
