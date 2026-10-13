import { SevaReferral } from "@/constants/sevaReferral";

export interface Seva {
    leftWithPinholeNew: string;
    leftWithoutPinholeNew: string;
    rightWithPinholeNew: string;
    rightWithoutPinholeNew: string;
    diagnosis: string;
    dateOfReferral: string; // "YYYY-MM-DD" format
    referral: SevaReferral | "";  // "" = no referral
    notes?: string;
}