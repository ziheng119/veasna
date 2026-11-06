// Sorting the Patient List by a column, done in the browser so it is instant and only changes this
// user's view. The default is English name, A to Z.

import { ALL_STATION_IDS } from "@/constants/stations";
import { PatientInfo } from "@/lib/types/patient";

export type PatientSortKey =
  | "english_name" | "khmer_name" | "date_of_birth" | "age" | "sex" | "phone_number"
  | "address" | "face_id" | "last_visit_date" | "current_station";

export interface PatientSort {
  key: PatientSortKey;
  direction: "asc" | "desc";
}

export const DEFAULT_PATIENT_SORT: PatientSort = { key: "english_name", direction: "asc" };

// A new column starts A to Z (youngest first for age); clicking the same column again flips it.
export function nextPatientSort(current: PatientSort, key: PatientSortKey): PatientSort {
  return current.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: "asc" };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const time = (date?: string | null) => (date ? new Date(date).getTime() : NaN);

// The value compared for a column: a string, a number, or null when the patient has none.
function sortValue(patient: PatientInfo, key: PatientSortKey): string | number | null {
  switch (key) {
    case "date_of_birth": return Number.isNaN(time(patient.date_of_birth)) ? null : time(patient.date_of_birth);
    // Youngest first: the latest date of birth.
    case "age": return Number.isNaN(time(patient.date_of_birth)) ? null : -time(patient.date_of_birth);
    case "last_visit_date": return Number.isNaN(time(patient.last_visit_date)) ? null : time(patient.last_visit_date);
    // Clinic order: Triage first. Patients not in the queue have none.
    case "current_station": return patient.current_station ? ALL_STATION_IDS.indexOf(patient.current_station) : null;
    default: {
      const value = patient[key];
      return typeof value === "string" && value.trim() ? value.trim() : null;
    }
  }
}

// Sorted copy; patients with nothing in the column always come last. Ties keep the list's order.
export function sortPatients(patients: PatientInfo[], sort: PatientSort): PatientInfo[] {
  const flip = sort.direction === "asc" ? 1 : -1;
  const values = new Map(patients.map((patient) => [patient, sortValue(patient, sort.key)]));
  return [...patients].sort((a, b) => {
    const x = values.get(a) ?? null;
    const y = values.get(b) ?? null;
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    const order = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
    return order * flip;
  });
}
