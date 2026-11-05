// Drawn strokes: points scaled 0..1 to the signature box.
export type SignatureStrokes = [number, number][][];
// An uploaded picture of a signature, shrunk to the signature box: a PNG or JPEG data URL.
export type SignatureUpload = { image: string };
export type Signature = SignatureStrokes | SignatureUpload;

export const isSignatureUpload = (value: Signature | null | undefined): value is SignatureUpload =>
    !!value && !Array.isArray(value);

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