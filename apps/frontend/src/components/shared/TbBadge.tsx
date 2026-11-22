import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Red marker for a patient flagged for suspected TB, shown wherever the patient is queued so
// doctors can spot them and attend to them. A TB card stays red when hovered or selected, only
// darker, instead of taking the blue highlight other cards use.
export function tbCardClass(selected = false): string {
  return selected
    ? "border-2 border-tb bg-tb-tint ring-2 ring-tb-line"
    : "border-2 border-tb-line bg-tb-soft hover:bg-tb-tint";
}

export default function TbBadge({ className }: { className?: string }) {
  return (
    <span
      title="Suspected TB"
      aria-label="Suspected TB"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-tb px-2 py-0.5 text-xs font-bold tracking-wide text-white",
        className,
      )}
    >
      <ShieldAlert className="size-3.5" aria-hidden="true" />
      TB
    </span>
  );
}
