// Sorting the Patient List by a column, done in the browser so it is instant and only changes this
// user's view. The default is Last Seen, most recent first: today's patients on top, the most recently
// registered first.

import { ALL_STATION_IDS } from "@/constants/stations";
import { PatientInfo } from "@/lib/types/patient";

export type PatientSortKey =
  | "english_name" | "khmer_name" | "date_of_birth" | "age" | "sex" | "phone_number"
  | "address" | "face_id" | "last_visit_date" | "current_station";

export interface PatientSort {
  key: PatientSortKey;
  direction: "asc" | "desc";
}

export const DEFAULT_PATIENT_SORT: PatientSort = { key: "last_visit_date", direction: "desc" };

// A new column starts A to Z (youngest first for age; most recent first for Last Seen); clicking the
// same column again flips it.
export function nextPatientSort(current: PatientSort, key: PatientSortKey): PatientSort {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: key === "last_visit_date" ? "desc" : "asc" };
}

// How a column is sorted, in words: "most recent first", "A to Z".
export function describeSort(sort: PatientSort): string {
  const ascending = sort.direction === "asc";
  switch (sort.key) {
    case "last_visit_date": return ascending ? "oldest first" : "most recent first";
    case "date_of_birth": return ascending ? "oldest first" : "youngest first";
    case "age": return ascending ? "youngest first" : "oldest first";
    case "current_station": return ascending ? "in clinic order" : "in reverse clinic order";
    default: return ascending ? "A to Z" : "Z to A";
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const time = (date?: string | null) => (date ? new Date(date).getTime() : NaN);

// The value compared for a column: a string, numbers (compared in turn), or null when the patient has none.
function sortValue(patient: PatientInfo, key: PatientSortKey): string | number[] | null {
  switch (key) {
    case "date_of_birth": return Number.isNaN(time(patient.date_of_birth)) ? null : [time(patient.date_of_birth)];
    // Youngest first: the latest date of birth.
    case "age": return Number.isNaN(time(patient.date_of_birth)) ? null : [-time(patient.date_of_birth)];
    // The day last seen, then when that visit was registered (patients seen the same day).
    case "last_visit_date": {
      const day = time(patient.last_visit_date);
      if (Number.isNaN(day)) return null;
      const registered = time(patient.last_visit_at);
      return [day, Number.isNaN(registered) ? 0 : registered];
    }
    // Clinic order: Triage first. Patients not in the queue have none.
    case "current_station": return patient.current_station ? [ALL_STATION_IDS.indexOf(patient.current_station)] : null;
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
    const order = Array.isArray(x) && Array.isArray(y)
      ? x.reduce((result, value, index) => result || value - y[index], 0)
      : collator.compare(String(x), String(y));
    return order * flip;
  });
}
