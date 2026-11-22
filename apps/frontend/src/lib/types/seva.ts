import { SevaReferral } from "@/constants/sevaReferral";

export interface Seva {
    leftWithPinholeNew: string;
    leftWithoutPinholeNew: string;
    rightWithPinholeNew: string;
    rightWithoutPinholeNew: string;
    // With the patient's own glasses; optional.
    leftWithGlassesNew: string;
    rightWithGlassesNew: string;
    diagnosis: string;
    dateOfReferral: string; // "YYYY-MM-DD" format
    referral: SevaReferral;  // an id on the seva_referrals list; "" = no referral
    notes?: string;
}