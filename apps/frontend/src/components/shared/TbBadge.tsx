import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Red marker for a patient flagged for suspected TB, shown wherever the patient is queued so
// doctors can spot them and attend to them. A TB card stays red when hovered or selected, only
// darker, instead of taking the blue highlight other cards use.
export function tbCardClass(selected = false): string {
  return selected
    ? "border-2 border-red-600 bg-red-100 ring-2 ring-red-500 dark:border-red-400 dark:bg-red-500/25"
    : "border-2 border-red-500 bg-red-50 hover:bg-red-100 dark:border-red-500/80 dark:bg-red-500/10 dark:hover:bg-red-500/20";
}

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
