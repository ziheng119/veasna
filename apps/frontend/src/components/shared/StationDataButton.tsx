"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { isAdmin } from "@/lib/permissions";
import { StationId, stationLabel } from "@/constants/stations";
import GlassButton from "./GlassButton";

/**
 * Admin-only "Edit station data" link, at the top right of a station page beside the queue search.
 * Opens the Station data page at this station's lists (dropdown and checkbox choices in its forms).
 */
export default function StationDataButton({ station }: { station: StationId }) {
  const admin = useUserStore((state) => isAdmin(state.user?.role));
  if (!admin) return null;
  return (
    // Same pill as "Print referrals" and "Referral list" beside it.
    <GlassButton asChild className="group ml-auto h-10 shrink-0 px-4">
      <Link href={`/station-data#${station}`} title={`Edit the choices offered in ${stationLabel(station)} forms`}>
        <SlidersHorizontal className="size-4 transition-transform duration-300 group-hover:rotate-90 motion-reduce:transform-none" aria-hidden="true" />
        Edit station data
      </Link>
    </GlassButton>
  );
}
