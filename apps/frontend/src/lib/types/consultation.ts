export interface Referral {
    referralDate: string; // Should be in "YYYY-MM-DD" format
    referralType: string[];
    illness: string;
    duration: string;
    reason: string;
}

export interface Consultation {
    notes: string;
    prescription: string;
    requireReferral: boolean;
    referral: Referral | null
}