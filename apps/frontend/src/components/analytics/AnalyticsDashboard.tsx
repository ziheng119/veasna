"use client";

import { CONDITION_COLORS, CONSULTATION_CONDITIONS, PRIMARY_SERIES_COLOR } from "@/constants/consultationConditions";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { getLocations } from "@/lib/api/location";
import { getAnalytics, Analytics, AnalyticsLocation, AnalyticsPeriod } from "@/lib/api/analytics";
import { Location } from "@/lib/types/location";
import { STATIONS } from "@/constants/stations";
import GlassButton from "@/components/shared/GlassButton";
import { BarList, DonutChart } from "./charts";
import TrendSection from "./TrendSection";

const panel = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";

export default function AnalyticsDashboard() {
  const token = useUserStore(state => state.user?.token);
  const currentLocation = useLocationStore(state => state.currentLocation);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<AnalyticsLocation>(currentLocation?.id ?? 0);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [condition, setCondition] = useState("diabetes");
  const [period, setPeriod] = useState<AnalyticsPeriod>("day");
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getLocations().then(items => {
      if (!active) return;
      setLocations(items);
      setLocationsLoaded(true);
      setLocationId(id => id === "all" || items.some(item => item.id === id) ? id : items[0]?.id ?? 0);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    if (!locationId || !date || !token) { setLoading(false); return; }
    setLoading(true);
    getAnalytics(locationId, date, token, controller.signal, period)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load analytics."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [locationId, date, token, refresh, period]);

  const visible = data?.date === date && (data.period ?? "day") === period && data.locationId === locationId ? data : null;
  const cards = visible ? [
    { label: "Patients reached", value: visible.summary.people, detail: `${visible.summary.visits} registered visits · unique patients counted once` },
    { label: "Patients consulted", value: visible.summary.consultedPeople, detail: "Unique patients with a completed Consult station" },
    { label: "Visits with referrals", value: visible.summary.referralVisits, detail: "Saved referrals, including unsigned drafts" },
    { label: "Visits discharged", value: visible.summary.dischargedVisits, detail: "Marked discharged from the clinic queue" },
  ] : [];
  const conditionTotal = visible?.conditions?.reduce((sum, item) => sum + item.count, 0) ?? 0;

  return <main className="min-h-screen bg-background px-5 py-6 text-foreground sm:px-8">
    <div className="mx-auto max-w-7xl space-y-7">
      <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden="true" /> Return
      </Link>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Project Battambang · Analytics</p>
        <h1 className="text-3xl font-semibold tracking-tight">Care at a glance</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Understand who your clinic reaches, where care is delivered, and what to plan for the next outreach.</p>
      </header>

      <section aria-label="Analytics filters" className={`${panel} flex flex-wrap items-end gap-4`}>
        <label className="flex min-w-48 flex-1 flex-col gap-2 text-sm font-medium">Clinic location
          <select aria-label="Clinic location" value={locationId} onChange={event => setLocationId(event.target.value === "all" ? "all" : Number(event.target.value))} className="h-10 rounded-lg border border-input bg-background px-3">
            {!locations.length && <option value={0}>{locationsLoaded ? "No locations available" : "Loading locations..."}</option>}
            {locations.length > 0 && <option value="all">All locations (overall)</option>}
            {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">Time period
          <select aria-label="Time period" value={period} onChange={event => setPeriod(event.target.value as AnalyticsPeriod)} className="h-10 rounded-lg border border-input bg-background px-3">
            <option value="day">Today / selected day</option><option value="week">Past week</option><option value="month">Past 30 days</option><option value="all">Overall</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">As of date
          <input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3" />
        </label>
        <GlassButton type="button" className="h-10" disabled={loading || !locationId || !date} onClick={() => setRefresh(value => value + 1)}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" /> Refresh
        </GlassButton>
        <p className="basis-full text-xs leading-5 text-muted-foreground">Counts use visit registration dates at the selected location, or every location for All locations. Past week and Past 30 days end on the selected date; Overall includes all dates through the selected date. They are not population prevalence or historical end-of-day snapshots.</p>
      </section>

      <div aria-live="polite">
        {loading && <p role="status" className="py-5 text-sm text-muted-foreground">Loading clinic activity...</p>}
        {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
        {!locationId && locationsLoaded && <p className="text-sm text-muted-foreground">No clinic locations could be loaded. Return to the clinic page to check the connection and location setup.</p>}
      </div>

      {visible && <>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>Saved clinic data</span><span>Updated {new Date(visible.generatedAt).toLocaleTimeString()}</span>
        </div>
        {!visible.summary.visits && <p className="rounded-xl bg-muted/40 p-4 text-sm">No visits are recorded for this location and period.</p>}
        <section aria-label="Clinic activity" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => <article key={card.label} className={panel}>
            <h2 className="text-sm font-medium text-muted-foreground">{card.label}</h2>
            <p className="my-3 text-4xl font-semibold tabular-nums">{card.value}</p>
            <p className="text-xs leading-5 text-muted-foreground">{card.detail}</p>
          </article>)}
        </section>
        {token && <TrendSection locationId={locationId} date={date} token={token} refresh={refresh} />}
        <div className="grid gap-5 lg:grid-cols-2">
          <section className={panel} aria-label="Condition analytics">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h2 className="text-base font-semibold">Conditions addressed in consultation</h2>
                <p className="mt-2 text-sm text-muted-foreground">Unique patients with a completed Consult station and a saved condition selection in this period.</p></div>
              <label className="flex flex-col gap-2 text-sm font-medium">Condition
                <select aria-label="Condition" value={condition} onChange={event => setCondition(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3">
                  {CONSULTATION_CONDITIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <p className="mt-5 text-sm font-medium">Patients consulted with {CONSULTATION_CONDITIONS.find(item => item.id === condition)?.label.toLowerCase()}</p>
            <p className="my-3 text-4xl font-semibold tabular-nums">{visible.summary.consultedVisits > 0 && visible.summary.conditionReviewedVisits === 0 ? "Not recorded" : (visible.conditions?.find(item => item.id === condition)?.count ?? 0)}</p>
            <p className="text-xs leading-5 text-muted-foreground">Condition selections recorded for {visible.summary.conditionReviewedVisits ?? 0} of {visible.summary.consultedVisits ?? 0} completed consultation visits. Missing selections are not negative findings. A patient can appear in multiple condition categories, but only once within each category for this period.</p>
            {visible.summary.conditionReviewedVisits < visible.summary.consultedVisits && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">Incomplete condition data: some consultations have not been classified. Counts reflect recorded selections only.</p>}
          </section>
          <section className={panel} aria-label="Condition mix">
            <h2 className="text-base font-semibold">Condition mix</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Share of all condition selections in this period. A patient with several conditions is counted in each one.</p>
            <div className="mt-5">
              {conditionTotal > 0
                ? <DonutChart caption="Condition mix for the selected period" centerLabel="selections"
                    items={visible.conditions.map(item => ({ ...item, color: CONDITION_COLORS[item.id] }))} />
                : <p className="py-10 text-center text-sm text-muted-foreground">No conditions recorded for this period.</p>}
            </div>
          </section>
        </div>
        {locationId === "all" && <section className={panel} aria-label="Location comparison">
          <h2 className="text-base font-semibold">Patients reached by location</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Unique patients per location. A patient seen at two locations is counted at both, so the total can exceed Patients reached.</p>
          <div className="mt-5">
            {visible.locations.length
              ? <BarList color={PRIMARY_SERIES_COLOR} unit="patients" items={visible.locations.map(row => ({
                  id: String(row.locationId), label: locations.find(item => item.id === row.locationId)?.name ?? `Location ${row.locationId}`,
                  value: row.people, detail: `${row.visits} visits`,
                }))} />
              : <p className="text-sm text-muted-foreground">No visits recorded at any location.</p>}
          </div>
        </section>}
        <div className="grid gap-5 lg:grid-cols-2">
          <section className={panel}>
            <h2 className="text-base font-semibold">Station workload</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Visits, not unique people. Waiting means currently at this station. Reopened stations return to pending.</p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground"><tr><th className="pb-3">Station</th><th className="pb-3 text-right">Assigned</th><th className="pb-3 text-right">Completed</th><th className="pb-3 text-right">Waiting</th></tr></thead>
                <tbody>{STATIONS.map(station => {
                  const row = visible.stations.find(item => item.station === station.id);
                  return <tr key={station.id} className="border-t border-border"><th className="py-3 font-medium">{station.label}</th><td className="text-right tabular-nums">{row?.assigned ?? 0}</td><td className="text-right tabular-nums">{row?.completed ?? 0}</td><td className="text-right tabular-nums">{row?.waiting ?? 0}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </section>
          <section className={panel}>
            <h2 className="text-base font-semibold">Who we reached</h2>
            <p className="mt-1 text-xs text-muted-foreground">Unique patients by age as of the selected date.</p>
            <div className="mt-6 space-y-5">{["Under 18", "18–59", "60+", "Unknown"].map(label => {
              const count = visible.ages.find(item => item.label === label)?.count ?? 0;
              return <div key={label}><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="tabular-nums">{count}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-teal-600/70" style={{ width: `${visible.summary.people ? count / visible.summary.people * 100 : 0}%` }} /></div>
              </div>;
            })}</div>
          </section>
          <section className={panel}>
            <h2 className="text-base font-semibold">Referral destinations</h2>
            <p className="mt-1 text-xs text-muted-foreground">A visit can select several destinations; counts may exceed referrals.</p>
            <ul className="mt-4 divide-y divide-border">{visible.destinations.map(item => <li key={item.label} className="flex justify-between gap-4 py-3 text-sm"><span>{item.label}</span><span className="tabular-nums">{item.count}</span></li>)}</ul>
            {!visible.destinations.length && <p className="mt-4 text-sm text-muted-foreground">No referral destinations recorded.</p>}
          </section>
          <section className={panel}>
            <h2 className="text-base font-semibold">Documentation check</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex justify-between gap-4"><dt>Visits with non-empty consultation notes</dt><dd className="tabular-nums">{visible.summary.notesSaved}</dd></div>
              <div className="flex justify-between gap-4"><dt>Unsigned saved referrals</dt><dd className="tabular-nums">{visible.summary.unsignedReferrals}</dd></div>
              <div className="flex justify-between gap-4"><dt>Patients with unknown or future birth dates</dt><dd className="tabular-nums">{visible.ages.find(item => item.label === "Unknown")?.count ?? 0}</dd></div>
            </dl>
            <p className="mt-5 text-xs leading-5 text-muted-foreground">Documentation counts are prompts for review, not measures of clinical quality. Saved notes do not necessarily mean a consultation is complete.</p>
          </section>
        </div>
      </>}

    </div>
  </main>;
}
