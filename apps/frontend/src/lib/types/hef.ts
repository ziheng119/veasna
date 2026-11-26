export interface HEF {
    know_of_hef: "yes" | "no" | "";
    has_hef: "yes" | "no" | "";
    // NSSF: the National Social Security Fund.
    has_nssf: "yes" | "no" | "";
    // Whether the patient uses HEF/NSSF is no longer asked as yes/no; notes holds the answer and why.
    notes: string;
}