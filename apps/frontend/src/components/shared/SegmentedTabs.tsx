"use client";

import { ComponentType } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { GLASS_SURFACE, PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface SegmentedTab {
  value: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  // Shows a small dot so users can see which tabs already hold data.
  marked?: boolean;
}

interface Props {
  tabs: SegmentedTab[];
  // The active tab; the parent <Tabs> must be controlled so the highlight can follow it.
  value: string;
  label: string;
  markedLabel?: string;
  className?: string;
}

/**
 * Tab list styled like QueueSortControl: a glass highlight slides to the active tab.
 * Place inside a controlled Radix <Tabs>; keyboard arrows and focus come from Radix.
 */
export default function SegmentedTabs({ tabs, value, label, markedLabel = "Has records", className }: Props) {
  const count = tabs.length;
  const index = Math.max(0, tabs.findIndex((tab) => tab.value === value));

  return (
    <TabsPrimitive.List
      aria-label={label}
      className={cn("relative isolate grid w-full gap-1 rounded-full bg-muted/40 p-1 backdrop-blur-md", className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {/* One persistent highlight, sized to a column and slid by whole columns (+ the 0.25rem gap). */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-1 left-1 top-1 rounded-full transition-transform duration-300 ease-in-out motion-reduce:transition-none",
          GLASS_SURFACE,
        )}
        style={{
          width: `calc((100% - 0.5rem - ${count - 1} * 0.25rem) / ${count})`,
          transform: `translateX(calc(${index} * (100% + 0.25rem)))`,
        }}
      />
      {tabs.map(({ value: tabValue, label: tabLabel, icon: Icon, disabled, marked }) => (
        <TabsPrimitive.Trigger
          key={tabValue}
          value={tabValue}
          disabled={disabled}
          title={tabLabel}
          className={cn(
            "group relative z-10 flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium sm:text-sm",
            "text-muted-foreground transition-colors duration-300 motion-reduce:transition-none",
            "hover:bg-background/30 hover:text-foreground data-[state=active]:text-foreground data-[state=active]:hover:bg-transparent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-40",
            PRESS,
          )}
        >
          {Icon && (
            <Icon className="size-4 shrink-0 transition-transform duration-300 group-hover:scale-110 group-data-[state=active]:scale-110 motion-reduce:transform-none" />
          )}
          <span className="truncate">{tabLabel}</span>
          {marked && (
            <>
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="sr-only">({markedLabel})</span>
            </>
          )}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
  );
}
