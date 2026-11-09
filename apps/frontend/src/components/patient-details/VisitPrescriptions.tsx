"use client";

import { VisitPrescription } from "@/lib/types/visit";
import { cn } from "@/lib/utils";

const STATUS: Record<VisitPrescription["status"], { label: string; tone: string }> = {
  pending: { label: "Waiting at Pharmacy", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  dispensed: { label: "Dispensed", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground" },
};

const when = (value: string | null) => (value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");

/** A prescription's history: who prescribed it and when, then who dispensed or cancelled it. */
export function prescriptionTrail(p: VisitPrescription): string {
  const steps = [`Prescribed ${when(p.prescribed_at)}${p.prescribed_by ? ` by ${p.prescribed_by}` : ""}`];
  if (p.status === "dispensed") steps.push(`dispensed ${when(p.dispensed_at)}${p.dispensed_by ? ` by ${p.dispensed_by}` : ""}`);
  if (p.status === "cancelled") steps.push(`cancelled ${when(p.cancelled_at)}${p.cancelled_by ? ` by ${p.cancelled_by}` : ""}`);
  return steps.join(", ");
}

/**
 * Medicines prescribed at Consult for this visit, read-only. They are changed where they happen:
 * prescribed at Consult, dispensed or cancelled at Pharmacy. A free-text prescription written before
 * prescribing used the pharmacy list is shown with the consultation notes.
 */
export default function VisitPrescriptions({ prescriptions }: { prescriptions: VisitPrescription[] }) {
  return (
    <section aria-label="Prescriptions" className="space-y-4 rounded-xl border border-border bg-card p-4 transition-shadow duration-300 hover:shadow-sm">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h4 className="text-lg font-semibold">Prescriptions</h4>
        <span className="text-xs text-muted-foreground">Prescribed at Consult, dispensed at Pharmacy</span>
      </div>
      {prescriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No medicines prescribed for this visit.</p>
      ) : (
        <ul className="divide-y divide-border">
          {prescriptions.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", p.status === "cancelled" && "text-muted-foreground line-through decoration-muted-foreground/60")}>
                  {p.drug_name} <span className="tabular-nums text-muted-foreground">× {p.quantity}</span>
                </p>
                {p.instructions?.trim() && <p className="text-sm">{p.instructions}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{prescriptionTrail(p)}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STATUS[p.status].tone)}>{STATUS[p.status].label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
