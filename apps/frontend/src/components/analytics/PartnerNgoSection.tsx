"use client";

import { useEffect, useState } from "react";
import { STATION_ICONS } from "@/components/shared/StationBadge";
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { AnalyticsPartnerNgo, AnalyticsPeriod, getAnalyticsPartnerNgo } from "@/lib/api/analytics";
import { cn } from "@/lib/utils";
import { hostToday } from "@/stores/useHostClockStore";
import PartnerNgoReferralTables from "@/components/seva/PartnerNgoReferralTables";
import { fieldClass, Segmented, SectionCard } from "./ui";

// This section picks its own range, like printing referrals, rather than following the page's filters.
type Range = "today" | "week" | "all" | "dates";
const RANGES: { id: Range; label: string; title?: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week", title: "Last 7 days" },
  { id: "all", label: "All time" },
  { id: "dates", label: "Choose dates" },
];

interface Props {
  id?: string;
  token: string;
  // Bumped by the page's Refresh button.
  refresh: number;
  delay?: number;
}

/**
 * Analytics: patients the Partner NGO station marked for referral in the period, by referral type,
 * with the referral date. The same tables as the station's Referral list pop-up, for the filters here.
 */
export default function PartnerNgoSection({ id, token, refresh, delay }: Props) {
  const today = hostToday();
  const [range, setRange] = useState<Range>("week");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  // Results are tagged with the request they answer, so a slow older answer is shown dimmed.
  const [result, setResult] = useState<{ key: string; data: AnalyticsPartnerNgo } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const problem = range === "dates" && (!from || !to || from > to) ? "The period must start on or before the day it ends." : "";
  const query: { date: string; period: AnalyticsPeriod; from?: string } | null =
    range === "today" ? { date: today, period: "day" }
    : range === "week" ? { date: today, period: "week" }
    : range === "all" ? { date: today, period: "all" }
    : problem ? null : { date: to, period: "all", from };
  const key = query ? `${query.date}|${query.period}|${query.from ?? ""}` : "";

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setError("");
    getAnalyticsPartnerNgo(query.date, query.period, token, controller.signal, query.from)
      .then(data => { if (!controller.signal.aborted) setResult({ key, data }); })
      .catch(err => { if (!controller.signal.aborted) { setResult(null); setError(err instanceof Error ? err.message : `Unable to load the ${PARTNER_NGO_NAME} referrals.`); } });
    return () => controller.abort();
    // `query` is rebuilt each render; `key` captures it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token, refresh, retry]);

  const data = result?.data ?? null;
  // Keep showing the previous tables (dimmed) while a new range loads.
  const current = result?.key === key;
  const total = data?.types.reduce((sum, type) => sum + type.patients.length, 0) ?? 0;
  const counts = data?.types.filter(type => type.patients.length > 0).map(type => `${type.label} ${type.patients.length}`).join(" · ");

  return <SectionCard id={id} icon={STATION_ICONS.seva} title={`${PARTNER_NGO_NAME} referrals`} label={`${PARTNER_NGO_NAME} referrals`} delay={delay}
    description={total > 0 ? `${total} ${total === 1 ? "patient" : "patients"} marked for referral in this period: ${counts}.` : `Patients marked for referral on the ${PARTNER_NGO_NAME} form, by referral type.`}
    info={`From "Referral needed" on the ${PARTNER_NGO_NAME} form, by visit date. The referral date is the one set on the form. Referral types are edited on the Station data page. This section has its own dates, separate from the page's time period.`}>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Segmented label={`${PARTNER_NGO_NAME} referral dates`} value={range} onChange={setRange} options={RANGES} />
      {range === "dates" && <>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">From
          <input type="date" value={from} max={today} onChange={event => setFrom(event.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">To
          <input type="date" value={to} max={today} onChange={event => setTo(event.target.value)} className={fieldClass} />
        </label>
      </>}
      {problem && <p role="alert" className="w-full text-sm text-destructive">{problem}</p>}
    </div>
    <div aria-live="polite">
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        <span>{error}</span>
        <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-full border border-destructive/30 px-3 py-1 font-medium transition hover:bg-destructive/10 active:scale-95">Try again</button>
      </div>}
      {!data && !error && <div role="status" aria-label={`Loading ${PARTNER_NGO_NAME} referrals`} className="h-32 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}
    </div>
    {data && <div className={cn("transition-opacity duration-200", !current && "opacity-60")} aria-busy={!current}>
      {total === 0
        ? <p className="grid min-h-24 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">No {PARTNER_NGO_NAME} referrals for this period.</p>
        : <PartnerNgoReferralTables types={data.types} linkNames />}
      {data.more && <p className="mt-3 text-xs text-muted-foreground">Showing the newest 500 patients. Choose a shorter period to see the rest.</p>}
    </div>}
  </SectionCard>;
}
