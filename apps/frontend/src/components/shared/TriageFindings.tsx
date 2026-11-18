"use client";

import { useEffect, useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { QueuedPatient } from "@/lib/types/patient";
import { PresentingComplaint } from "@/lib/types/medicalHistory";
import { getPresentingComplaint } from "@/lib/api/visit/getPresentingComplaints";
import { useVisitChanges } from "@/hooks/useVisitChanges";
import { StationMark } from "./StationBadge";
import { useRememberedOpen } from "@/hooks/useRememberedOpen";
import SnellensTestDetails from "./read-only/triage-container/SnellensTestDetails";

// Triage's presenting complaint, in the words of its own form; allergies first, as they change
// what can be given here.
const FIELDS: [key: keyof PresentingComplaint, label: string][] = [
  ["drug_allergies", "Drug allergies"],
  ["history", "Presenting symptoms"],
  ["red_flags", "Other red flags"],
  ["systems_review", "Systems review"],
];

// "None", "nil", "NKDA"…: nothing to warn about.
const NO_ALLERGY = /^(none|nil|no|n\/?a|nkda|nkfda|-)\.?$/i;

/**
 * What Triage found, for the stations after it, as a label and value list lined up like
 * Registration's: drug allergies (marked when there are any) and the presenting complaint (only
 * what was filled in), then the Snellen's test as a dropdown with every reading. Open by default;
 * staff can fold it away. Saves made at Triage on another device show here without a reload.
 */
export default function TriageFindings({ patient }: { patient: QueuedPatient }) {
  // undefined while loading; null when Triage saved no presenting complaint.
  const [complaint, setComplaint] = useState<PresentingComplaint | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const changes = useVisitChanges(patient.visit_id);
  const [open, setOpen] = useRememberedOpen("triage-findings");

  useEffect(() => {
    let cancelled = false;
    if (changes === 0) { setComplaint(undefined); setFailed(false); }
    getPresentingComplaint(patient.patient_id, patient.visit_id)
      .then((data) => { if (!cancelled) { setComplaint(data); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [patient.patient_id, patient.visit_id, changes]);

  // The API sends "N/A" for a box left empty: left out, like an empty one.
  const rows = FIELDS.filter(([key]) => { const value = complaint?.[key]?.trim(); return value && value !== "N/A"; }).map(([key, label]) => ({ key, label, value: complaint![key].trim() }));

  // Allergies stay in sight when the section is folded.
  const allergy = rows.find(({ key, value }) => key === "drug_allergies" && !NO_ALLERGY.test(value))?.value;

  return (
    <details open={open} onToggle={(event) => { if (event.currentTarget.open !== open) setOpen(event.currentTarget.open); }} className="group/triage">
      <summary className="flex cursor-pointer select-none list-none items-center gap-2.5 rounded-md text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <StationMark station="triage" className="size-6" />
        From Triage
        {allergy && (
          <span className="flex min-w-0 items-center gap-1.5 font-medium text-amber-800 group-open/triage:hidden dark:text-amber-300">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Allergy: {allergy}</span>
          </span>
        )}
        <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform duration-200 group-open/triage:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="mt-3 space-y-3">
        {failed ? (
          <p className="text-sm text-muted-foreground">Couldn&apos;t load what Triage recorded. It shows again once the host can be reached.</p>
        ) : complaint === undefined ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">Loading what Triage recorded…</p>
        ) : rows.length ? (
          // Same rhythm as Registration's list above: a 9rem label column, the value beside it.
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr] sm:gap-y-1">
            {rows.map(({ key, label, value }) => {
              const allergy = key === "drug_allergies" && !NO_ALLERGY.test(value);
              return (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={allergy ? "flex items-start gap-1.5 font-medium text-amber-800 dark:text-amber-300" : "whitespace-pre-wrap text-foreground"}>
                    {allergy && <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                    <span className="whitespace-pre-wrap">{allergy && <span className="sr-only">Allergy: </span>}{value}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No presenting complaint recorded at Triage.</p>
        )}
        {/* Every reading, folded: the summary line shows both eyes without pinhole. */}
        <SnellensTestDetails patient={patient} />
      </div>
    </details>
  );
}
