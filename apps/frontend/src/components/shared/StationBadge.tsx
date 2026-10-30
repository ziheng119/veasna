import { ComponentType } from "react";
import { Activity, Eye, HeartPulse, Stethoscope } from "lucide-react";
import { StationId, stationLabel } from "@/constants/stations";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

// One icon and colour per station, so a station reads the same wherever it appears.
export const STATION_ICONS: Record<StationId, Icon> = {
  triage: HeartPulse,
  seva: Eye,
  physiotherapy: Activity,
  consultation: Stethoscope,
};

const STATION_TONES: Record<StationId, string> = {
  triage: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  seva: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  physiotherapy: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  consultation: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

/** Pill naming the station a patient is waiting at; "All done" when no station is left. */
export default function StationBadge({ station, className }: { station: StationId | null | undefined; className?: string }) {
  const Icon = station ? STATION_ICONS[station] : null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        station ? STATION_TONES[station] : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {station ? stationLabel(station) : "All done"}
    </span>
  );
}
