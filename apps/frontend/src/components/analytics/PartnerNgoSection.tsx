"use client";

import { useEffect, useState } from "react";
import { STATION_ICONS } from "@/components/shared/StationBadge";
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { AnalyticsPartnerNgo, AnalyticsPeriod, getAnalyticsPartnerNgo } from "@/lib/api/analytics";
import { cn } from "@/lib/utils";
import PartnerNgoReferralTables from "@/components/seva/PartnerNgoReferralTables";
import { SectionCard } from "./ui";

interface Props {
  id?: string;
  date: string;
  period: AnalyticsPeriod;
  token: string;
  // Bumped by the page's Refresh button.
  refresh: number;
  delay?: number;
}

/**
 * Analytics: patients the Partner NGO station marked for referral in the period, by referral type,
 * with the referral date. The same tables as the station's Referral list pop-up, for the filters here.
 */
export default function PartnerNgoSection({ id, date, period, token, refresh, delay }: Props) {
  const [data, setData] = useState<AnalyticsPartnerNgo | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getAnalyticsPartnerNgo(date, period, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) { setData(null); setError(err instanceof Error ? err.message : `Unable to load the ${PARTNER_NGO_NAME} referrals.`); } });
    return () => controller.abort();
  }, [date, period, token, refresh, retry]);

  // Keep showing the previous tables (dimmed) while new filters load.
  const current = data?.date === date && data.period === period;
  const total = data?.types.reduce((sum, type) => sum + type.patients.length, 0) ?? 0;
  const counts = data?.types.filter(type => type.patients.length > 0).map(type => `${type.label} ${type.patients.length}`).join(" · ");

  return <SectionCard id={id} icon={STATION_ICONS.seva} title={`${PARTNER_NGO_NAME} referrals`} label={`${PARTNER_NGO_NAME} referrals`} delay={delay}
    description={total > 0 ? `${total} ${total === 1 ? "patient" : "patients"} marked for referral in this period: ${counts}.` : `Patients marked for referral on the ${PARTNER_NGO_NAME} form, by referral type.`}
    info={`From "Referral needed" on the ${PARTNER_NGO_NAME} form, by visit date. The referral date is the one set on the form. Referral types are edited on the Station data page.`}>
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
