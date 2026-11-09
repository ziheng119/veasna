"use client";

import { Check } from "lucide-react";
import { STATION_ICONS } from "@/components/shared/StationBadge";
import { StationId, stationLabel } from "@/constants/stations";
import { VisitStation } from "@/lib/types/visit";
import { cn } from "@/lib/utils";

const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Where a visit went, in route order: each station ticked with its finishing time, or still to come. */
export function visitStatusText(stations: VisitStation[], completedAt: string | null): string {
  if (completedAt) return `Visit finished at ${time(completedAt)}`;
  const current = stations.find((s) => !s.completed_at);
  return current ? `In the clinic, at ${stationLabel(current.station)}` : "In the clinic";
}

export default function VisitStations({ stations, completedAt }: { stations: VisitStation[]; completedAt: string | null }) {
  if (stations.length === 0) return null;
  const current = completedAt ? null : stations.find((s) => !s.completed_at)?.station ?? null;
  return (
    <section aria-label="Stations" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="font-medium">Stations</span>
      <ol className="flex flex-wrap items-center gap-1.5">
        {stations.map((s) => {
          const Icon = STATION_ICONS[s.station as StationId];
          const done = s.completed_at !== null;
          return (
            <li key={s.station}
              title={done ? `Finished at ${time(s.completed_at!)}` : s.station === current ? "Waiting here now" : "Not reached"}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                done ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : s.station === current ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}>
              {Icon && <Icon className="size-3.5" aria-hidden="true" />}
              {stationLabel(s.station)}
              {done && <Check className="size-3" aria-label="finished" />}
            </li>
          );
        })}
      </ol>
      <span className="text-xs text-muted-foreground">{visitStatusText(stations, completedAt)}</span>
    </section>
  );
}
