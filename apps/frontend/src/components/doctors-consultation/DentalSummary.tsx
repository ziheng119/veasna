"use client";

import { useEffect, useState } from "react";
import { Smile } from "lucide-react";
import { DentalNotes, getDental } from "@/lib/api/visit/dental";

/** The Dental station's notes for this visit, so the doctor can refer the patient on if needed. */
export default function DentalSummary({ visitId }: { visitId: number }) {
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

  return (
    <section className="space-y-2 rounded-xl border border-border p-4" aria-label="Dental notes">
      <h3 className="flex items-center gap-2 font-semibold">
        <Smile className="size-4 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
        Dental notes
        {dental?.referral_needed && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Referral needed
          </span>
        )}
      </h3>
      {state === "loading" && <p className="text-xs text-muted-foreground">Loading…</p>}
      {state === "failed" && <p role="alert" className="text-xs text-destructive">Unable to load dental notes.</p>}
      {state === "loaded" && (dental
        ? <p className="whitespace-pre-wrap">{dental.notes || "No notes written."}</p>
        : <p className="text-xs text-muted-foreground">Not seen at Dental yet.</p>)}
    </section>
  );
}
