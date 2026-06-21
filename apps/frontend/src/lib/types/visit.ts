import { HEF } from "./hef";
import { VisualAcuity } from "./visualAcuity";
import { PresentingComplaint } from "./medicalHistory";
import { Seva } from "./seva";
import { Physiotherapy } from "./physiotherapy";
import { Consultation } from "./consultation";
import { Vitals } from "./vitals";

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
    has_vitals: boolean;
    has_presenting_complaint: boolean;
    has_seva: boolean;
    has_physiotherapy: boolean;
    has_consultation: boolean;
  }
  
  export interface VisitDetails {
    visit_id: number;
    patient_id: number;
    queue_no: string;
    visit_date: string;
    location_name: string;
    last_updated_at: string;
    created_at: string;
    vitals?: Vitals;
    hef?: HEF;
    visual_acuity?: VisualAcuity;
    presenting_complaint?: PresentingComplaint;
    history?: History;
    seva?: Seva;
    physiotherapy?: Physiotherapy;
    consultation?: Consultation;
  }