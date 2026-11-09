"use client";

import { useEffect, useId, useState } from "react";
import { Smile } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DentalNotes, getDental } from "@/lib/api/visit/dental";
import { ENTER_FAST } from "@/lib/motion";

/**
 * What the Dental station recorded for this visit: whether the students ticked "Referral needed",
 * and their notes, so the doctor can refer the patient on (Create referral). Read-only here; it is
 * changed at the Dental station.
 */
export default function DentalSummary({ visitId }: { visitId: number }) {
  const id = useId();
  const [dental, setDental] = useState<DentalNotes | null>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    getDental(visitId, controller.signal)
      .then((data) => { setDental(data); setState("loaded"); })
      .catch(() => { if (!controller.signal.aborted) setState("failed"); });
    return () => controller.abort();
  }, [visitId]);

  const referralNeeded = state === "loaded" && dental?.referral_needed === true;

  return (
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Dental notes" aria-busy={state === "loading"}>
      <h3 className="flex items-center gap-2 font-semibold">
        <Smile className="size-4 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
        Dental notes
      </h3>
      <div className="flex items-start gap-2">
        {/* Shows the Dental station's answer; it can't be ticked here. */}
        <Checkbox id={id} checked={referralNeeded} disabled aria-readonly="true"
          className="mt-0.5 disabled:cursor-default disabled:opacity-100" />
        <div>
          <Label htmlFor={id} className="font-semibold">Referral required from Dental</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {state === "loaded" && !dental ? "Not seen at Dental yet."
              : referralNeeded ? "Ticked at Dental. Write it with Create referral below."
              : "Ticked at the Dental station when the patient needs a referral."}
          </p>
        </div>
      </div>
      {state === "loading" && <div className="h-12 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}
      {state === "failed" && <p role="alert" className="text-xs text-destructive">Unable to load dental notes. Switch patients and try again.</p>}
      {state === "loaded" && dental && (
        <p key={visitId} className={`whitespace-pre-wrap rounded-lg bg-muted/40 p-3 ${ENTER_FAST}`}>
          {dental.notes.trim() || <span className="text-muted-foreground">No notes written.</span>}
        </p>
      )}
    </section>
  );
}
