import { VisitSummary } from "./visit";

export type PatientInfo = {
    id: number;
    face_id: number;
    location_id: number;
    english_name?: string;
    khmer_name?: string;
    date_of_birth: string;
    sex?: "M" | "F" | "";
    address?: string | null;
    phone_number?: string | null;
    lastUpdated: string;
}

export type QueuedPatient = {
    visit_id: number;
    patient_id: number;
    queue_no: string;
    english_name?: string;
    khmer_name?: string;
    age?: number;
    sex?: "M" | "F";
    timestamp: string;
}

export type PatientFormData = {
    face_id?: string;
    english_name?: string;
    khmer_name?: string;
    date_of_birth?: string;  // e.g., "dd/mm/yyyy"
    sex?: "M" | "F" | "";
    address?: string;
    phone_number?: string;
    queue_no?: string;
    age?: string;
    height?: string;
    weight?: string;
    bmi?: string;
    below_3rd_percentile?: boolean;
    category?: string;
    bp_systolic?: string;
    bp_diastolic?: string;
    temperature?: string;
    know_of_hef?: string;
    has_hef?: string;
    notes?: string;
}

export interface PatientWithVisits {
    patient: {
      id: number;
      face_id: number;
      location_id: number;
      english_name: string;
      khmer_name: string;
      date_of_birth: string;
      sex: "M" | "F" | null;
      address?: string;
      phone_number?: string;
      last_updated_at: string;
      created_at: string;
      location_name: string;
    };
    visits: VisitSummary[];
  }