import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Red marker for a patient flagged for suspected TB, shown wherever the patient is queued so
// doctors can spot them and attend to them.
export const TB_CARD_CLASS = "border-2 border-red-500 bg-red-50 dark:border-red-500/80 dark:bg-red-500/10";

export default function TbBadge({ className }: { className?: string }) {
  return (
    <span
      title="Suspected TB"
      aria-label="Suspected TB"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold tracking-wide text-white",
        className,
      )}
    >
      <ShieldAlert className="size-3.5" aria-hidden="true" />
      TB
    </span>
  );
}
