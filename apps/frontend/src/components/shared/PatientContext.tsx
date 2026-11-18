"use client";

import { useId } from "react";
import { QueuedPatient } from "@/lib/types/patient";
import RegistrationSummary from "./RegistrationSummary";
import TriageFindings from "./TriageFindings";
import HistoryContainer from "./read-only/patient-container/history/HistoryContainer";

/**
 * What the stations before this one recorded, at the top of the open patient's column on a station
 * surface (StationSurface): From Registration (with Patient history) and From Triage. Read-only, on
 * a tinted band like the queue, so it sits apart from the white form below.
 */
export default function PatientContext({ patient }: { patient: QueuedPatient }) {
  const headingId = useId();
  return (
    <div className="space-y-4 border-b border-border bg-muted/40 px-5 py-4">
      <section aria-labelledby={headingId} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id={headingId} className="text-sm font-semibold text-foreground">From Registration</h3>
          <HistoryContainer patient={patient} variant="button" />
        </div>
        <RegistrationSummary patient={patient} />
      </section>
      <div className="border-t border-border pt-4">
        <TriageFindings patient={patient} />
      </div>
    </div>
  );
}
