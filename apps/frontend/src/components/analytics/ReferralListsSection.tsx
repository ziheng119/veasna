"use client";

import Link from "next/link";
import { ComponentType, useEffect, useState } from "react";
import { printSavedReferrals } from "@/components/shared/PrintReferralsDialog";
import toast from "react-hot-toast";
import { FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIMARY_SERIES_COLOR } from "@/constants/consultationConditions";
import { letterheadLogoUrl } from "@/constants/letterhead";
import { AnalyticsPeriod, AnalyticsReferralLists, getAnalyticsReferrals, ReferralList } from "@/lib/api/analytics";
import { writeAndPrint } from "@/lib/printDocument";
import { ENTER_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ageSex, referralListDocumentHtml } from "./referralListDocument";
import { SectionCard } from "./ui";
import { readableDate } from "./dates";
import FamilyBadge from "@/components/shared/FamilyBadge";
import TbBadge from "@/components/shared/TbBadge";
import StickerTag, { findSticker, useStickerColours } from "@/components/shared/StickerTag";

// Stagger the first few patients; later ones appear together so long lists stay quick.
const MAX_STAGGERED = 8;

const plural = (count: number) => `${count} ${count === 1 ? "patient" : "patients"}`;

interface Props {
  id?: string;
  icon: ComponentType<{ className?: string }>;
  date: string;
  period: AnalyticsPeriod;
  // How the period reads on the printout, e.g. "15 Oct – 21 Oct 2026".
  dateRange: string;
  token: string;
  // Bumped by the page's Refresh button.
  refresh: number;
  delay?: number;
}

/**
 * Analytics: how many patients were referred to each destination, and who they are. Pick a
 * destination to list its patients; print one list or every list to take on referral days.
 * Admin only, like the rest of Analytics.
 */
export default function ReferralListsSection({ id, icon, date, period, dateRange, token, refresh, delay }: Props) {
  const [data, setData] = useState<AnalyticsReferralLists | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [printingReferrals, setPrintingReferrals] = useState(false);
  const stickers = useStickerColours();

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getAnalyticsReferrals(date, period, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) { setData(null); setError(err instanceof Error ? err.message : "Unable to load referral lists."); } });
    return () => controller.abort();
  }, [date, period, token, refresh, retry]);

  // Keep showing the previous lists (dimmed) while new filters load, instead of flashing empty.
  const current = data?.date === date && data.period === period;
  const lists = data?.destinations ?? [];
  const total = lists.reduce((sum, list) => sum + list.patients.length, 0);
  const max = Math.max(1, ...lists.map(list => list.patients.length));
  // The chosen destination, or the first one with patients once the filters change.
  const selected = lists.find(list => list.label === chosen) ?? lists.find(list => list.patients.length > 0) ?? lists[0] ?? null;

  const print = (printed: ReferralList[]) => {
    if (!printed.some(list => list.patients.length > 0)) { toast("No referred patients to print."); return; }
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Allow pop-ups to print referral lists."); return; }
    writeAndPrint(popup, referralListDocumentHtml(printed, { dateRange, logoUrl: letterheadLogoUrl() }));
  };

  // The saved referral letters of the patients on one destination's list, one per page.
  const printReferrals = async (list: ReferralList) => {
    if (printingReferrals) return;
    setPrintingReferrals(true);
    try { await printSavedReferrals({ kind: "visits", visitIds: list.patients.map(patient => patient.visitId) }); }
    finally { setPrintingReferrals(false); }
  };

  return <SectionCard id={id} icon={icon} title="Patients by referral destination" label="Referral lists" delay={delay}
    description="Who was referred where in this period. Pick a destination to see its patients. A referral can name several destinations, so the lists can add up to more than the visits with referrals."
    info="Each referred visit is listed once under every destination on its referral, so a patient referred to two places appears in both lists. Unsigned drafts are included. It does not confirm the patient attended."
    actions={<Button type="button" variant="outline" size="sm" disabled={!current || total === 0} onClick={() => print(lists)}>
      <Printer aria-hidden="true" />Print all lists
    </Button>}>
    <div aria-live="polite">
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in duration-200 motion-reduce:animate-none">
        <span>{error}</span>
        <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-full border border-destructive/30 px-3 py-1 font-medium transition hover:bg-destructive/10 active:scale-95">Try again</button>
      </div>}
      {!data && !error && <div role="status" aria-label="Loading referral lists" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" style={{ animationDelay: `${i * 100}ms` }} />)}</div>
        <div className="h-48 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      </div>}
    </div>

    {data && <div className={cn("grid gap-6 transition-opacity duration-200 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]", !current && "opacity-60")} aria-busy={!current}>
      <ul className="space-y-1" aria-label="Referral destinations">
        {lists.map((list, index) => {
          const isSelected = selected?.label === list.label;
          const count = list.patients.length;
          return <li key={list.label}>
            <button type="button" aria-pressed={isSelected} onClick={() => setChosen(list.label)}
              className={cn("group w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none",
                isSelected && "bg-muted ring-1 ring-border")}>
              <span className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
                <span className="min-w-0 truncate font-medium">{list.label}</span>
                <span className="shrink-0 tabular-nums">{count}</span>
              </span>
              <span className="block h-2 overflow-hidden rounded-full bg-background" aria-hidden="true">
                <span className="bar-grow block h-full rounded-full transition-[width,filter] duration-500 group-hover:brightness-110"
                  style={{ width: `${count / max * 100}%`, background: PRIMARY_SERIES_COLOR, animationDelay: `${index * 60}ms` }} />
              </span>
              {!list.listed && <span className="mt-1.5 block text-xs text-muted-foreground">No longer on the destination list</span>}
            </button>
          </li>;
        })}
      </ul>

      <div className="min-w-0 rounded-xl border border-border">
        {total === 0 || !selected ? (
          <p className="grid h-full min-h-48 place-items-center px-4 text-center text-sm text-muted-foreground">No referrals saved for this period.</p>
        ) : <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{selected.label}</h3>
              <p className="text-xs text-muted-foreground">{plural(selected.patients.length)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={selected.patients.length === 0} onClick={() => print([selected])}>
                <Printer aria-hidden="true" />Print list
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={selected.patients.length === 0 || printingReferrals}
                title={`Print ${selected.label} letters`} onClick={() => void printReferrals(selected)}>
                <FileText aria-hidden="true" />{printingReferrals ? "Preparing..." : "Print referrals"}
              </Button>
            </div>
          </div>
          {selected.patients.length === 0
            ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">No patients referred to {selected.label} in this period.</p>
            : <ol key={selected.label} className="max-h-[28rem] divide-y divide-border overflow-y-auto" aria-label={`Patients referred to ${selected.label}`}>
              {selected.patients.map((patient, index) => {
                const reason = [patient.condition, patient.reason].filter(text => text?.trim()).join(": ");
                const who = ageSex(patient);
                return <li key={patient.visitId} className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40", ENTER_FAST)}
                  style={{ animationDelay: `${Math.min(index, MAX_STAGGERED) * 40}ms` }}>
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <Link href={`/patient-details?id=${patient.patientId}`} className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                        {patient.englishName || "Unnamed patient"}
                      </Link>
                      {patient.khmerName && <span className="text-muted-foreground">{patient.khmerName}</span>}
                      {/* The same markers as the queue, so the list matches the patients on the day. */}
                      <span className="inline-flex items-center gap-1.5 self-center">
                        {patient.tbStatus === "flagged" && <TbBadge />}
                        {patient.family && <FamilyBadge family={patient.family} />}
                        <StickerTag sticker={findSticker(stickers, patient.stickerColour)} />
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[who === "–" ? null : who, `Queue ${patient.queueNo}`, readableDate(patient.visitDate), patient.signed ? null : "Unsigned draft"].filter(Boolean).join(" · ")}
                    </p>
                    {(patient.phone || patient.address) && <p className="text-xs text-muted-foreground">{[patient.phone, patient.address].filter(Boolean).join(" · ")}</p>}
                    {reason && <p className="pt-1 leading-5">{reason}</p>}
                  </div>
                </li>;
              })}
            </ol>}
        </>}
      </div>
    </div>}
  </SectionCard>;
}
