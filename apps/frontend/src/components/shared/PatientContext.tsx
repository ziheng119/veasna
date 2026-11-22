"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRememberedOpen } from "@/hooks/useRememberedOpen";
import { Collapse } from "./FamilyGrouping";
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
  const contentId = useId();
  // Foldable like From Triage, so the form starts higher; remembered on this device.
  const [open, setOpen] = useRememberedOpen("registration-summary");
  return (
    <div className="space-y-4 border-b border-border bg-muted/40 px-5 py-4">
      <section aria-labelledby={headingId}>
        <div className="flex items-center justify-between gap-3">
          <h3 id={headingId} className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            <button type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(!open)}
              className="flex w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              From Registration
              <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
            </button>
          </h3>
          <HistoryContainer patient={patient} variant="button" />
        </div>
        <Collapse open={open}>
          <div id={contentId} className="pt-3"><RegistrationSummary patient={patient} /></div>
        </Collapse>
      </section>
      <div className="border-t border-border pt-4">
        <TriageFindings patient={patient} />
      </div>
    </div>
  );
}
