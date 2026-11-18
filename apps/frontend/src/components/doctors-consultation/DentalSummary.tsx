"use client";

import { useEffect, useState } from "react";
import { FileText, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DentalNotes, getDental } from "@/lib/api/visit/dental";
import { ENTER_FAST } from "@/lib/motion";
import { useVisitChanges } from "@/hooks/useVisitChanges";

interface Props {
  visitId: number;
  // Opens the referral, starting from the Dental notes. Offered when Dental asked for a referral.
  onRefer?: (notes: string) => void;
  // The visit already has a referral: the button opens it instead.
  referralWritten?: boolean;
}

/**
 * What the Dental station recorded for this visit: whether the students ticked "Referral needed",
 * and their notes, so the doctor can refer the patient on from here. Read-only here; it is changed
 * at the Dental station.
 */
export default function DentalSummary({ visitId, onRefer, referralWritten = false }: Props) {
  const [dental, setDental] = useState<DentalNotes | null>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  // A save at Dental (another device) reloads this quietly.
  const changes = useVisitChanges(visitId);

  useEffect(() => {
    const controller = new AbortController();
    if (changes === 0) setState("loading");
    getDental(visitId, controller.signal)
      .then((data) => { setDental(data); setState("loaded"); })
      .catch(() => { if (!controller.signal.aborted) setState("failed"); });
    return () => controller.abort();
  }, [visitId, changes]);

  const referralNeeded = state === "loaded" && dental?.referral_needed === true;

  return (
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Dental notes" aria-busy={state === "loading"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Smile className="size-4 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
          Dental notes
        </h3>
        {/* The Dental station's answer, as a status rather than a checkbox that can't be ticked. */}
        {state === "loaded" && (
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium",
            referralNeeded ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" : "bg-muted text-muted-foreground")}>
            {!dental ? "Not seen at Dental yet" : referralNeeded ? "Referral needed" : "No referral needed"}
          </span>
        )}
      </div>
      {state === "loading" && <div className="h-12 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}
      {state === "failed" && <p role="alert" className="text-xs text-destructive">Unable to load dental notes. Switch patients and try again.</p>}
      {state === "loaded" && dental && (
        <p key={visitId} className={`whitespace-pre-wrap rounded-lg bg-muted/40 p-3 ${ENTER_FAST}`}>
          {dental.notes.trim() || <span className="text-muted-foreground">No notes written.</span>}
        </p>
      )}
      {/* Dental asked for a referral: write it from here, starting from their notes. */}
      {referralNeeded && onRefer && (
        <Button type="button" variant="outline" size="sm" onClick={() => onRefer(dental?.notes.trim() ?? "")}>
          <FileText aria-hidden="true" />
          {referralWritten ? "Open the referral" : "Write referral from these notes"}
        </Button>
      )}
    </section>
  );
}
