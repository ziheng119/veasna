import { ComponentType, ReactNode } from "react";
import { Activity, Eye, HeartPulse, Pill, Smile, Stethoscope } from "lucide-react";
import { StationId, stationLabel } from "@/constants/stations";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string }>;

// One icon and colour per station, so a station reads the same wherever it appears.
export const STATION_ICONS: Record<StationId, Icon> = {
  triage: HeartPulse,
  consultation: Stethoscope,
  physiotherapy: Activity,
  dental: Smile,
  seva: Eye,
  pharmacy: Pill,
};

// Each station's fill (100) and ink (700/800, at least 4.5:1 on the fill and on white).
const STATION_FILL: Record<StationId, string> = {
  triage: "bg-blue-100",
  seva: "bg-violet-100",
  physiotherapy: "bg-amber-100",
  consultation: "bg-emerald-100",
  dental: "bg-cyan-100",
  pharmacy: "bg-rose-100",
};
export const STATION_INK: Record<StationId, string> = {
  triage: "text-blue-700",
  seva: "text-violet-700",
  physiotherapy: "text-amber-800",
  consultation: "text-emerald-700",
  dental: "text-cyan-800",
  pharmacy: "text-rose-700",
};
const STATION_TONES = Object.fromEntries(
  (Object.keys(STATION_FILL) as StationId[]).map((id) => [id, `${STATION_FILL[id]} ${STATION_INK[id]}`]),
) as Record<StationId, string>;

/** The station's icon on its colour: marks the station's own queue and forms, so staff see where they are. */
export function StationMark({ station, className }: { station: StationId; className?: string }) {
  const Icon = STATION_ICONS[station];
  return (
    <span aria-hidden="true" className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md", STATION_TONES[station], className)}>
      <Icon className="size-4" />
    </span>
  );
}

/** A card title led by the station's mark, e.g. "Dental Notes" on the Dental page. `mark={false}` leaves it out where room is short. */
export function StationTitle({ station, mark = true, children }: { station: StationId; mark?: boolean; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {mark && <StationMark station={station} />}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

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
