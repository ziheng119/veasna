export type Signature = [number, number][][];

export interface Referral {
    signature?: Signature | null;
    signerName?: string | null;
    signerId?: number | null;
    signedAt?: string | null;
    referralDate: string; // Should be in "YYYY-MM-DD" format
    referralType: string[];
    illness: string;
    duration: string;
    reason: string;
}

export interface Consultation {
    conditionCategories?: string[] | null;
    hasSavedNotes?: boolean;
    notes: string;
    prescription: string;
    requireReferral: boolean;
    referral: Referral | null
}