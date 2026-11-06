"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { isAdmin } from "@/lib/permissions";
import { StationId, stationLabel } from "@/constants/stations";
import { GLASS_SURFACE, PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Admin-only "Edit station data" link, at the top right of a station page beside the queue search.
 * Opens the Station data page at this station's lists (dropdown and checkbox choices in its forms).
 */
export default function StationDataButton({ station }: { station: StationId }) {
  const admin = useUserStore((state) => isAdmin(state.user?.role));
  if (!admin) return null;
  return (
    <Link href={`/station-data#${station}`} title={`Edit the choices offered in ${stationLabel(station)} forms`}
      className={cn("ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium text-foreground transition duration-200 hover:bg-muted/50 hover:shadow-md motion-reduce:transition-none", GLASS_SURFACE, PRESS)}>
      <SlidersHorizontal className="size-4" aria-hidden="true" />
      Edit station data
    </Link>
  );
}
