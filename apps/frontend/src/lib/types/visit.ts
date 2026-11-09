import { TbStatus } from "@/constants/tb";
import type { StationId } from "@/constants/stations";
import { Signature } from "./consultation";

export type Visit = {
    id?: number;
    patient_id: number;
    location_id: number;
    queue_no: string;
    visit_date: string;
    last_updated_at: string;
    last_updated_by: string;
    created_at: string;
}

export interface VisitSummary {
    visit_id: number;
    queue_no: string;
    visit_date: string;
    location_name: string;
    last_updated_at: string;
    // Set when the visit is finished (discharged or done at every station).
    completed_at?: string | null;
    has_vitals: boolean;
    has_presenting_complaint: boolean;
    has_triage?: boolean;
    has_dental?: boolean;
    has_seva: boolean;
    has_physiotherapy: boolean;
    has_consultation: boolean;
    has_referral?: boolean;
    // Medicines prescribed and not cancelled.
    prescription_count?: number;
    // Flagged for suspected TB (not cleared).
    has_tb_flag?: boolean;
    // This account may change the visit's records: the admin any visit, everyone else only the
    // visits of their day (apps/backend/utils/dayScope.js saveScope).
    editable?: boolean;
  }
  
// Full visit returned by GET /api/patient/visit/:id (snake_case, as stored). A station
// section is null when it was never recorded for the visit.
export interface VisitDetails {
    visit_id: number;
    patient_id: number;
    queue_no: string;
    visit_date: string;  // YYYY-MM-DD
    location_id: number | null;
    location_name: string | null;
    // Registration sticker: an id from the sticker_colours list, or null.
    sticker_colour?: string | null;
    completed_at: string | null;
    last_updated_at: string;
    created_at: string;
    vitals: VisitVitals | null;
    hef: VisitHef | null;
    visual_acuity: VisitVisualAcuity | null;
    presenting_complaint: VisitPresentingComplaint | null;
    history: VisitHistory | null;
    seva: VisitSeva | null;
    physiotherapy: VisitPhysiotherapy | null;
    dental: VisitDental | null;
    consultation: VisitConsultation | null;
    referrals: VisitReferral[];
    // Medicines prescribed at Consult, oldest first.
    prescriptions?: VisitPrescription[];
    // The stations the visit was sent to, in route order.
    stations?: VisitStation[];
    tb: VisitTb | null;
}

export interface VisitPrescription {
    id: number;
    drug_name: string;
    quantity: number;
    instructions: string | null;
    status: "pending" | "dispensed" | "cancelled";
    prescribed_at: string;
    prescribed_by: string | null;
    dispensed_at: string | null;
    dispensed_by: string | null;
    cancelled_at: string | null;
    cancelled_by: string | null;
}

export interface VisitStation {
    station: StationId;
    position: number;
    entered_at: string | null;
    completed_at: string | null;
}

export interface VisitVitals {
    height: string | number;
    weight: string | number;
    bmi: string | number;
    below_3rd_percentile: boolean;
    bp_systolic: number;
    bp_diastolic: number;
    temperature: string | number;
    notes: string | null;
}

export interface VisitHef {
    know_of_hef: boolean;
    has_hef: boolean;
    notes: string | null;
}

// Snellen fractions such as "20/40"; null until taken.
export interface VisitVisualAcuity {
    left_with_pinhole: string | null;
    left_without_pinhole: string | null;
    right_with_pinhole: string | null;
    right_without_pinhole: string | null;
    left_with_glasses?: string | null;
    right_with_glasses?: string | null;
    notes: string | null;
}

export interface VisitPresentingComplaint {
    history: string;
    red_flags: string;
    systems_review: string;
    drug_allergies: string;
}

export interface VisitHistory {
    past: string;
    drug_and_treatment: string;
    family: string;
    social: string;
    systems_review: string;
}

export interface VisitSeva {
    left_with_pinhole_new: string | null;
    left_without_pinhole_new: string | null;
    right_with_pinhole_new: string | null;
    right_without_pinhole_new: string | null;
    left_with_glasses_new?: string | null;
    right_with_glasses_new?: string | null;
    diagnosis: string;
    date_of_referral: string | null;
    referral: string | null;
    notes: string | null;
}

export interface VisitDental {
    notes: string;
    referral_needed: boolean;
}

export interface VisitPhysiotherapy {
    notes: string | null;
    painpoints: { id: number; x_coord: number; y_coord: number }[];
}

export interface VisitConsultation {
    notes: string | null;
    prescription: string;
    require_referral: boolean;
    // null = not recorded; [] = none of the listed conditions.
    condition_categories: string[] | null;
}

export interface VisitReferral {
    id: number;
    referral_date: string | null;
    referral_type: string;  // newline-separated destinations
    illness: string;
    duration: string;
    reason: string;
    signature: Signature | null;
    signer_name: string | null;
    signed_at: string | null;
    doctor_name?: string | null;
}

// TB screening of a visit flagged for suspected TB.
export interface VisitTb {
    red_flags: string[];
    flag_notes: string;
    status: TbStatus;
    doctor_notes: string;
    reviewed_at: string | null;
}
