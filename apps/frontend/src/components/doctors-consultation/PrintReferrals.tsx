"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import GlassButton from "../shared/GlassButton";
import PrintReferralsDialog from "../shared/PrintReferralsDialog";

/** "Print referrals" on the Consult page: pick a day (today by default) and print its saved referrals. */
export default function PrintReferrals({ locationId }: { locationId?: number }) {
  const [open, setOpen] = useState(false);
  return <>
    <GlassButton type="button" className="h-10 shrink-0" disabled={!locationId}
      onClick={() => setOpen(true)} title="Print saved referrals for a day at the selected location">
      <Printer className="size-4" aria-hidden="true" />
      Print referrals
    </GlassButton>
    <PrintReferralsDialog open={open} onOpenChange={setOpen} locationId={locationId} choices={["today", "date"]} />
  </>;
}
