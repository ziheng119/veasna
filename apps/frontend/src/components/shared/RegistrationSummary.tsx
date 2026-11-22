"use client";

import { useEffect, useState } from "react";
import { QueuedPatient, PatientInfo } from "@/lib/types/patient";
import { Vitals } from "@/lib/types/vitals";
import { getVitals } from "@/lib/api/visit/getVitals";
import { getPatient } from "@/lib/api/patients/getPatient";
import { cn } from "@/lib/utils";

type Item = [label: string, value: string, note?: string];
type Loaded = { vitals: Vitals | null; details: PatientInfo | null };

// Readings worth a second look, marked with a word as well as colour. Screening thresholds, not a
// diagnosis: the doctor at Consult decides.
const HIGH_BP = { systolic: 140, diastolic: 90 };
const RAISED_TEMP_C = 37.5;

// "" for a missing reading, so it is left out.
const reading = (value: unknown, unit = "") => {
  const text = value == null ? "" : String(value).trim();
  return text ? `${text}${unit}` : "";
};

/**
 * What Registration recorded for this visit, under the patient header at a station: height, weight
 * and BMI in one column; blood pressure, temperature, date of birth and phone in the other. Missing
 * readings are left out.
 */
export default function RegistrationSummary({ patient }: { patient: QueuedPatient }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setFailed(false);
    Promise.all([
      getVitals(patient.patient_id, patient.visit_id),
      getPatient(patient.patient_id).catch(() => null),
    ])
      .then(([vitals, details]) => { if (!cancelled) setLoaded({ vitals, details }); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [patient.patient_id, patient.visit_id]);

  if (failed) return <p className="text-sm text-muted-foreground">Couldn&apos;t load the registration details. They show again once the host can be reached.</p>;
  if (!loaded) return <p className="text-sm text-muted-foreground" aria-live="polite">Loading registration details…</p>;

  const { vitals: v, details } = loaded;
  const bp = v?.bp_systolic && v?.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "";
  const highBp = Boolean(bp) && (Number(v?.bp_systolic) >= HIGH_BP.systolic || Number(v?.bp_diastolic) >= HIGH_BP.diastolic);
  const raisedTemp = v?.temperature != null && Number(v.temperature) >= RAISED_TEMP_C;
  // [label, value, what is unusual about it]. Body size in one column; blood pressure, temperature
  // and the patient's details in the other.
  const body: Item[] = [
    ["Height", reading(v?.height, " cm")],
    ["Weight", reading(v?.weight, " kg")],
    ["BMI", reading(v?.bmi), v?.below_3rd_percentile ? "below 3rd percentile" : undefined],
  ];
  const signs: Item[] = [
    ["Blood pressure", bp, highBp ? "high" : undefined],
    ["Temperature", reading(v?.temperature, " °C"), raisedTemp ? "raised" : undefined],
    ["Date of birth", reading(details?.date_of_birth)],
    ["Phone", reading(details?.phone_number)],
  ];
  const columns = [body, signs].map((items) => items.filter(([, value]) => value)).filter((items) => items.length);

  return (
    <section aria-label="From registration">
      {columns.length ? (
        // One reading per line, read down: label on the left, value beside it.
        <div className="flex flex-wrap gap-x-12 gap-y-3">
          {columns.map((items) => (
            // A 9rem label column, as in TriageFindings, so the two lists line up on Dental.
            <dl key={items[0][0]} className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
              {items.map(([label, value, note]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn("font-medium tabular-nums", note ? "text-warning-ink" : "text-foreground")}>
                    {value}
                    {note && <span className="ml-1.5 rounded-full bg-warning-tint px-1.5 py-0.5 text-xs font-medium">{note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No vitals were recorded at registration.</p>
      )}
      {v?.notes?.trim() && <p className="mt-2 text-sm text-foreground"><span className="text-muted-foreground">Vitals notes </span>{v.notes}</p>}
    </section>
  );
}
