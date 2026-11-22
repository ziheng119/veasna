export interface VisualAcuity {
    left_with_pinhole: string;
    left_without_pinhole: string;
    right_with_pinhole: string;
    right_without_pinhole: string;
    // With the patient's own glasses; optional.
    left_with_glasses: string;
    right_with_glasses: string;
    notes?: string;
    // Ticked at Triage: the patient should see an optician (listed on Analytics).
    refer_optician?: boolean;
}