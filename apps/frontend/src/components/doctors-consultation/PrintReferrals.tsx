"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import GlassButton from "../shared/GlassButton";
import PrintReferralsDialog from "../shared/PrintReferralsDialog";
import { useUserStore } from "@/stores/useUserStore";
import { can } from "@/lib/permissions";

/**
 * "Print referrals" on the Consult page: pick a day (today by default) and print its saved referrals.
 * Needs the "Print and download" permission, like printing a single referral; hidden without it.
 */
export default function PrintReferrals() {
  const [open, setOpen] = useState(false);
  const allowed = useUserStore((state) => can(state.user, "print"));
  if (!allowed) return null;
  return <>
    <GlassButton type="button" className="h-10 shrink-0 px-4"
      onClick={() => setOpen(true)} title="Print saved referrals for a day">
      <Printer className="size-4" aria-hidden="true" />
      Print referrals
    </GlassButton>
    <PrintReferralsDialog open={open} onOpenChange={setOpen} choices={["today", "date"]} />
  </>;
}
