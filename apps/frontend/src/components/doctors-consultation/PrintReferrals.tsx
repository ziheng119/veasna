"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import GlassButton from "../shared/GlassButton";
import PrintReferralsDialog from "../shared/PrintReferralsDialog";
import { useUserStore } from "@/stores/useUserStore";
import { isAdmin } from "@/lib/permissions";

/**
 * "Print referrals" on the Consult page: pick a day (today by default) and print its saved referrals.
 * Admin only; anyone can still print the one referral they open.
 */
export default function PrintReferrals({ locationId }: { locationId?: number }) {
  const [open, setOpen] = useState(false);
  const admin = useUserStore((state) => isAdmin(state.user?.role));
  if (!admin) return null;
  return <>
    <GlassButton type="button" className="h-10 shrink-0 px-4" disabled={!locationId}
      onClick={() => setOpen(true)} title="Print saved referrals for a day at the selected location">
      <Printer className="size-4" aria-hidden="true" />
      Print referrals
    </GlassButton>
    <PrintReferralsDialog open={open} onOpenChange={setOpen} locationId={locationId} choices={["today", "date"]} />
  </>;
}
