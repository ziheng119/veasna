"use client";

import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { referralBatchDocumentHtml } from "@/components/doctors-consultation/ReferralDocument";
import { getReferrals, ReferralRange } from "@/lib/api/visit/getReferrals";
import { writeAndPrint } from "@/lib/printDocument";
import { letterheadLogoUrl } from "@/constants/letterhead";
import { ENTER_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { hostToday } from "@/stores/useHostClockStore";

export type ReferralChoice = "today" | "date" | "period" | "all";

const CHOICES: Record<ReferralChoice, string> = {
  today: "Today",
  date: "A date",
  period: "A period",
  all: "All dates",
};

const readable = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// How the chosen range reads in messages: "today", "on 3 Nov 2026", "from 1 to 5 Nov 2026"...
export function rangeText(range: ReferralRange, today = hostToday()): string {
  if (range.kind === "all") return "on any date";
  if (range.kind === "date") return range.date === today ? "today" : `on ${readable(range.date)}`;
  return range.from === range.to ? `on ${readable(range.from)}` : `from ${readable(range.from)} to ${readable(range.to)}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // A location id, or "all" for every location.
  locationId?: number | "all";
  // Which ranges to offer, in order; the first is chosen when the pop-up opens.
  choices?: ReferralChoice[];
  // The date the "A date" choice starts on (today by default).
  initialDate?: string;
}

/**
 * Pop-up to print saved referrals (signed or not) for a day, a period or every date. Each referral
 * prints on its own page in one print window.
 */
export default function PrintReferralsDialog({ open, onOpenChange, ...form }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-md">
        {/* Inside the content, so the choices start afresh each time the pop-up opens. */}
        <PrintReferralsForm {...form} busy={busy} setBusy={setBusy} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PrintReferralsForm({ locationId, choices = ["today", "date"], initialDate, busy, setBusy, onDone }:
  Omit<Props, "open" | "onOpenChange"> & { busy: boolean; setBusy: (busy: boolean) => void; onDone: () => void }) {
  const today = hostToday();
  const [choice, setChoice] = useState<ReferralChoice>(choices[0]);
  const [date, setDate] = useState(initialDate ?? today);
  const [from, setFrom] = useState(initialDate ?? today);
  const [to, setTo] = useState(initialDate ?? today);
  const pending = useRef(false);

  const range: ReferralRange | null =
    choice === "today" ? { kind: "date", date: today }
    : choice === "date" ? (date ? { kind: "date", date } : null)
    : choice === "period" ? (from && to && from <= to ? { kind: "period", from, to } : null)
    : { kind: "all" };
  const problem = choice === "period" && from && to && from > to ? "The period must start on or before the day it ends." : "";

  const print = async () => {
    if (!locationId || !range || pending.current) return;
    // Opened straight from the click, so the browser doesn't block it as an unwanted pop-up.
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Allow pop-ups to print referrals."); return; }
    popup.document.title = "Preparing referrals";
    popup.document.body.textContent = "Loading saved referrals...";
    pending.current = true;
    setBusy(true);
    try {
      const referrals = await getReferrals(locationId, range);
      if (popup.closed) return;
      if (!referrals.length) {
        popup.close();
        toast(`No saved referrals ${rangeText(range, today)}${locationId === "all" ? "" : " at this location"}.`);
        return;
      }
      writeAndPrint(popup, referralBatchDocumentHtml(referrals, { logoUrl: letterheadLogoUrl() }));
      onDone();
    } catch (error) {
      popup.close();
      console.error("Referral printing failed:", error);
      toast.error("Unable to prepare referrals. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const field = "mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
      <>
        <DialogHeader>
          <DialogTitle>Print referrals</DialogTitle>
          <DialogDescription>
            Saved referrals, signed or not, {locationId === "all" ? "at every location" : "at this location"}. Each prints on its own page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {choices.length > 1 && (
            <div role="radiogroup" aria-label="Which referrals" className="grid gap-1 rounded-xl bg-muted p-1"
              style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}>
              {choices.map((id) => {
                const selected = id === choice;
                return (
                  <button key={id} type="button" role="radio" aria-checked={selected} onClick={() => setChoice(id)}
                    className={cn(
                      "h-8 rounded-lg px-2 text-sm font-medium transition-all duration-200 active:scale-95 motion-reduce:transform-none",
                      selected ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                    )}>
                    {CHOICES[id]}
                  </button>
                );
              })}
            </div>
          )}

          <div key={choice} className={ENTER_FAST}>
            {choice === "today" && <p className="text-muted-foreground">Referrals dated today, {readable(today)}.</p>}
            {choice === "date" && (
              <label className="block font-medium">Referral date
                <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className={field} />
              </label>
            )}
            {choice === "period" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block font-medium">From
                  <input type="date" value={from} max={today} onChange={(event) => setFrom(event.target.value)} className={field} />
                </label>
                <label className="block font-medium">To
                  <input type="date" value={to} max={today} onChange={(event) => setTo(event.target.value)} className={field} />
                </label>
              </div>
            )}
            {choice === "all" && <p className="text-muted-foreground">Every saved referral, oldest first. This can be a long print.</p>}
            {problem && <p role="alert" className="mt-2 text-destructive">{problem}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onDone}>Cancel</Button>
          <Button type="button" disabled={busy || !range || !locationId} onClick={() => void print()}>
            <Printer className="size-4" aria-hidden="true" />
            {busy ? "Preparing..." : "Print"}
          </Button>
        </DialogFooter>
      </>
  );
}
