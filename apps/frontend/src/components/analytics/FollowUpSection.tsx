"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import FamilyBadge from "@/components/shared/FamilyBadge";
import StationBadge from "@/components/shared/StationBadge";
import StickerTag, { findSticker, useStickerColours } from "@/components/shared/StickerTag";
import TbBadge from "@/components/shared/TbBadge";
import { STATIONS, StationId } from "@/constants/stations";
import { AnalyticsFollowUp, AnalyticsPeriod, FollowUpPatient, getAnalyticsFollowUp } from "@/lib/api/analytics";
import { cn } from "@/lib/utils";
import { SectionCard } from "./ui";
import { shortDate } from "./dates";

interface Props {
  id?: string;
  date: string;
  period: AnalyticsPeriod;
  // True for today's Day view: patients not discharged are still waiting in the clinic.
  live: boolean;
  token: string;
  refresh: number;
  delay?: number;
}

const isStation = (station: string | null): station is StationId => STATIONS.some(item => item.id === station);

/**
 * Who still needs something before the day (or trip) can be closed: visits not discharged, at the
 * station they are at, and referrals saved without a signature. Names link to the patient's record.
 */
export default function FollowUpSection({ id, date, period, live, token, refresh, delay }: Props) {
  const [data, setData] = useState<AnalyticsFollowUp | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const stickers = useStickerColours();

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getAnalyticsFollowUp(date, period, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load the follow-up lists."); });
    return () => controller.abort();
  }, [date, period, token, refresh, retry]);

  // The previous lists stay (dimmed) while new filters load.
  const current = data?.date === date && data.period === period;
  const multiDay = period !== "day";
  const openTitle = live ? "Still in the clinic" : "Not discharged";

  const name = (patient: FollowUpPatient, extra?: ReactNode) => <>
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="w-10 shrink-0 tabular-nums text-muted-foreground">#{patient.queueNo}</span>
      <Link href={`/patient-details?id=${patient.patientId}`} className="min-w-0 truncate rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {patient.englishName || patient.khmerName || "Unnamed patient"}
      </Link>
      {patient.tbStatus === "flagged" && <TbBadge />}
      {patient.family && <FamilyBadge family={patient.family} />}
      <StickerTag sticker={findSticker(stickers, patient.stickerColour)} />
      {multiDay && <span className="text-xs text-muted-foreground">{shortDate(patient.visitDate)}</span>}
    </span>
    {extra}
  </>;

  const list = (title: string, empty: string, more: boolean, rows: ReactNode[]) => <div className="min-w-0">
    {/* Amber while anything is outstanding; a green tick once the list is clear. */}
    <h3 className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">{title}
      <span className={cn("inline-flex min-w-6 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        rows.length ? "bg-warning-tint text-warning-ink" : "bg-success-soft text-success-ink")}>
        {rows.length === 0 && <CheckCircle2 className="size-3.5" aria-hidden="true" />}{rows.length}{more && "+"}
      </span></h3>
    {rows.length === 0
      ? <p className="flex items-center justify-center gap-2 rounded-lg border border-success-line bg-success-soft px-3 py-4 text-center text-sm text-success-ink">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />{empty}</p>
      : <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">{rows}</ul>}
    {more && <p className="mt-2 text-xs text-muted-foreground">Showing the first 200. Pick a shorter period to see the rest.</p>}
  </div>;

  return <SectionCard id={id} icon={ClipboardList} title="Needs follow-up" label="Needs follow-up" delay={delay}
    description={live ? "Before closing the day: who is still in the clinic, and referrals that still need a signature." : "Visits in this period that were never discharged, and referrals saved without a signature."}
    info={<>{openTitle} lists visits not marked discharged, with the station they are at. {live ? "" : "On a past date these are visits that were left open, not patients still waiting. "}Unsigned referrals are saved referral forms with no signature yet.</>}>
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
      <span>{error}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>Try again</Button>
    </div>}
    {!data && !error && <div role="status" aria-label="Loading follow-up lists" className="grid gap-6 md:grid-cols-2">
      {[0, 1].map(i => <div key={i} className="h-32 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}
    </div>}
    {data && <div className={cn("grid gap-6 transition-opacity duration-200 md:grid-cols-2", !current && "opacity-60")} aria-busy={!current}>
      {list(openTitle, live ? "Everyone has been discharged." : "Every visit was discharged.", data.notDischargedMore,
        data.notDischarged.map(patient => <li key={patient.visitId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          {name(patient, <StationBadge station={isStation(patient.station) ? patient.station : null} />)}
        </li>))}
      {list("Unsigned referrals", "Every saved referral is signed.", data.unsignedReferralsMore,
        data.unsignedReferrals.map(patient => <li key={patient.visitId} className="space-y-1 px-3 py-2 text-sm">
          {name(patient)}
          {patient.destinations.length > 0 && <p className="pl-12 text-xs text-muted-foreground">{patient.destinations.join(" · ")}</p>}
        </li>))}
    </div>}
  </SectionCard>;
}
