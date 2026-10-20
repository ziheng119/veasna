"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { getLocations } from "@/lib/api/location";
import { getAnalytics, Analytics } from "@/lib/api/analytics";
import { Location } from "@/lib/types/location";
import { STATIONS } from "@/constants/stations";
import GlassButton from "@/components/shared/GlassButton";

const panel = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";
const ideas = [
  { title: "Chronic conditions", question: "How many people with diabetes were consulted?", needs: "Structured clinician-confirmed diagnoses, distinguishing known disease, new diagnoses and suspected cases." },
  { title: "Continuity of care", question: "Did referred patients reach the next service?", needs: "Referral attendance, follow-up dates and outcomes. A saved referral alone does not confirm care was received." },
  { title: "Access and outreach", question: "Which communities are we reaching or missing?", needs: "Consistent village codes, travel barriers and first/returning visit data; compare clinic days and locations." },
  { title: "Medicines and supplies", question: "What should the next outreach team bring?", needs: "Dispensed quantities, unmet prescriptions and stock-out history, linked to clinic dates." },
];

export default function AnalyticsDashboard() {
  const token = useUserStore(state => state.user?.token);
  const currentLocation = useLocationStore(state => state.currentLocation);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState(currentLocation?.id ?? 0);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
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
      setLocationId(id => items.some(item => item.id === id) ? id : items[0]?.id ?? 0);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    if (!locationId || !date || !token) { setLoading(false); return; }
    setLoading(true);
    getAnalytics(locationId, date, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load analytics."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [locationId, date, token, refresh]);

  const visible = data?.date === date && data.locationId === locationId ? data : null;
  const cards = visible ? [
    { label: "Patients reached", value: visible.summary.people, detail: `${visible.summary.visits} registered visits · unique patients counted once` },
    { label: "Patients consulted", value: visible.summary.consultedPeople, detail: "Unique patients with a completed Consult station" },
    { label: "Visits with referrals", value: visible.summary.referralVisits, detail: "Saved referrals, including unsigned drafts" },
    { label: "Visits discharged", value: visible.summary.dischargedVisits, detail: "Marked discharged from the clinic queue" },
  ] : [];

  return <main className="min-h-screen bg-background px-5 py-6 text-foreground sm:px-8">
    <div className="mx-auto max-w-7xl space-y-7">
      <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden="true" /> Return
      </Link>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Project Battambang · Admin</p>
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">Care at a glance</h1>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">Analytics draft</span></div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Understand who your clinic reaches, where care is delivered, and what to plan for the next outreach.</p>
      </header>

      <section aria-label="Analytics filters" className={`${panel} flex flex-wrap items-end gap-4`}>
        <label className="flex min-w-48 flex-1 flex-col gap-2 text-sm font-medium">Clinic location
          <select value={locationId} onChange={event => setLocationId(Number(event.target.value))} className="h-10 rounded-lg border border-input bg-background px-3">
            {!locations.length && <option value={0}>{locationsLoaded ? "No locations available" : "Loading locations..."}</option>}
            {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">Visit date
          <input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3" />
        </label>
        <GlassButton type="button" className="h-10" disabled={loading || !locationId || !date} onClick={() => setRefresh(value => value + 1)}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" /> Refresh
        </GlassButton>
        <p className="basis-full text-xs leading-5 text-muted-foreground">Counts describe visits registered on this date at this location, using their current saved status. They are not population prevalence or historical end-of-day snapshots.</p>
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
        {!visible.summary.visits && <p className="rounded-xl bg-muted/40 p-4 text-sm">No visits are recorded for this location and date.</p>}
        <section aria-label="Clinic activity" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => <article key={card.label} className={panel}>
            <h2 className="text-sm font-medium text-muted-foreground">{card.label}</h2>
            <p className="my-3 text-4xl font-semibold tabular-nums">{card.value}</p>
            <p className="text-xs leading-5 text-muted-foreground">{card.detail}</p>
          </article>)}
        </section>
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
            <p className="mt-1 text-xs text-muted-foreground">Unique patients by age on the selected visit date.</p>
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

      <section className="rounded-2xl border border-teal-700/15 bg-teal-50/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-800">Proposed next steps · Not yet measured</p>
        <h2 className="mt-2 text-xl font-semibold">Questions that could guide future outreach</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Diabetes counts are not available reliably yet. Consultation notes are free text: a mention could describe a family history, a ruled-out condition, or a confirmed diagnosis. Structured capture should come before a disease-count dashboard.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{ideas.map(idea => <article key={idea.title} className="rounded-xl bg-card/80 p-5">
          <h3 className="text-sm font-semibold">{idea.title}</h3><p className="mt-2 text-sm">{idea.question}</p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground"><span className="font-medium">Data to add or validate: </span>{idea.needs}</p>
        </article>)}</div>
      </section>
    </div>
  </main>;
}
