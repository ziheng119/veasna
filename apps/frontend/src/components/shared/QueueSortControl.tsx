"use client";

import { Button } from "@/components/ui/button";
import { QueueSortMode } from "@/lib/queueSort";
import { cn } from "@/lib/utils";

export default function QueueSortControl({ mode, onChange }: {
  mode: QueueSortMode;
  onChange: (mode: QueueSortMode) => void;
}) {
  return (
    <div className="w-full space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Sort queue by</p>
      <div role="group" aria-label="Queue sort order" className="relative isolate grid w-full grid-cols-2 gap-1 rounded-full border border-border bg-muted/30 p-1 backdrop-blur-md">
        {/* One persistent highlight slides between equal-width options without delaying sorting. It is
            filled like a queue number on Registration (brand blue at 14%), with the label in blue. */}
        <span
          aria-hidden="true"
          className={cn("pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.375rem)] rounded-full transition-transform duration-300 ease-in-out motion-reduce:transition-none", "bg-primary/14")}
          style={{ transform: mode === "arrival" ? "translateX(calc(100% + 0.25rem))" : "translateX(0)" }}
        />
        {([['number', 'Queue number'], ['arrival', 'Arrival time']] as const).map(([value, label]) => (
          <Button key={value} type="button" size="sm" variant="ghost"
            aria-pressed={mode === value} onClick={() => onChange(value)}
            className={`relative z-10 h-8 w-full min-w-0 rounded-full border-0 px-2 text-xs transition-colors duration-300 motion-reduce:transition-none ${
              mode === value
                ? "font-semibold text-primary hover:bg-transparent hover:text-primary"
                : "text-muted-foreground hover:bg-background/30"
            }`}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
