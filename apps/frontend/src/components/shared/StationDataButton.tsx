"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/stores/useUserStore";
import { isAdmin } from "@/lib/permissions";
import { StationId, stationLabel } from "@/constants/stations";

// The stations whose forms offer choices the admin can edit on Station data.
const STATIONS_WITH_DATA: ReadonlySet<StationId> = new Set(["triage", "consultation", "seva"]);

/**
 * Admin-only "Edit station data" icon in a station's queue header, beside the waiting count, so it
 * takes no row of its own. Opens the Station data page at this station's lists (the dropdown and
 * checkbox choices in its forms). The user menu's Station data opens the same page.
 */
export default function StationDataButton({ station }: { station: StationId }) {
  const admin = useUserStore((state) => isAdmin(state.user?.role));
  if (!admin || !STATIONS_WITH_DATA.has(station)) return null;
  const label = `Edit ${stationLabel(station)} station data`;
  return (
    <Button asChild type="button" variant="ghost" size="icon" className="group size-7 text-muted-foreground hover:text-accent-foreground">
      <Link href={`/station-data#${station}`} aria-label={label} title={`${label}: the choices offered in its forms`}>
        <SlidersHorizontal className="size-4 transition-transform duration-300 group-hover:rotate-90 motion-reduce:transform-none" aria-hidden="true" />
      </Link>
    </Button>
  );
}
