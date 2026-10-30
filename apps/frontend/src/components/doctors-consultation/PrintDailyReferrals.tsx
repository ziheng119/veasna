"use client";

import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import toast from "react-hot-toast";
import GlassButton from "../shared/GlassButton";
import { getDailyReferrals } from "@/lib/api/visit/getDailyReferrals";
import { referralBatchDocumentHtml } from "./ReferralDocument";
import { writeAndPrint } from "@/lib/printDocument";
import { letterheadLogoUrl } from "@/constants/letterhead";

export default function PrintDailyReferrals({ locationId }: { locationId?: number }) {
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const print = async () => {
    if (!locationId || pending.current) return;
    // Open synchronously on the click so browsers do not block an asynchronous popup.
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Allow pop-ups to print referrals."); return; }
    popup.document.title = "Preparing referrals";
    popup.document.body.textContent = "Loading today's saved referrals...";
    pending.current = true;
    setLoading(true);
    try {
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const referrals = await getDailyReferrals(locationId, date);
      if (popup.closed) return;
      if (!referrals.length) {
        popup.close();
        toast("No saved referrals for today at this location.");
        return;
      }
      writeAndPrint(popup, referralBatchDocumentHtml(referrals, { logoUrl: letterheadLogoUrl() }));
    } catch (error) {
      popup.close();
      console.error("Daily referral printing failed:", error);
      toast.error("Unable to prepare referrals. Please try again.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };
  return <GlassButton type="button" className="h-10 shrink-0" disabled={!locationId || loading}
    onClick={() => void print()} title="Print saved referrals dated today at the selected location">
    <Printer className="size-4" aria-hidden="true" />
    {loading ? "Preparing referrals..." : "Print today's referrals"}
  </GlassButton>;
}
