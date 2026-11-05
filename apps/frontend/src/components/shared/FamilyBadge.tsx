import { Users } from "lucide-react";
import { familyTone } from "@/lib/family";
import { cn } from "@/lib/utils";

// Family letter next to a queue number: members of the same family share a letter and a colour.
export default function FamilyBadge({ family, className }: { family: string; className?: string }) {
  return (
    <span
      title={`Family ${family}`}
      aria-label={`Family ${family}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
        familyTone(family).badge,
        className,
      )}
    >
      <Users className="size-3" aria-hidden="true" />
      {family}
    </span>
  );
}
