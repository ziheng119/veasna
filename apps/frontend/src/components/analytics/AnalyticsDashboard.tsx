"use client";

import { CONDITION_COLORS, CONSULTATION_CONDITIONS, PRIMARY_SERIES_COLOR } from "@/constants/consultationConditions";
import Link from "next/link";
import { ComponentType, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity, ArrowLeft, BarChart3, CalendarDays, CalendarX2, CheckCircle2, ClipboardCheck, FileWarning, HeartPulse, Info,
  Lightbulb, MapPin, PieChart, RefreshCw, Send, Stethoscope, Users, X,
} from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { getLocations } from "@/lib/api/location";
import { getAnalytics, Analytics, AnalyticsLocation, AnalyticsPeriod, AnalyticsTrend } from "@/lib/api/analytics";
import { Location } from "@/lib/types/location";
import { STATIONS } from "@/constants/stations";
import { cn } from "@/lib/utils";
import GlassButton from "@/components/shared/GlassButton";
import { BarList, DonutChart } from "./charts";
import TrendSection from "./TrendSection";
import { buildAnalyticsCsv, downloadFile } from "./exportCsv";
import { enter, ExportMenu, fieldClass, InfoTip, panel, Segmented, SectionCard } from "./ui";

const PERIODS: { id: AnalyticsPeriod; label: string; title: string }[] = [
  { id: "day", label: "Day", title: "Only the selected date" },
  { id: "week", label: "Week", title: "The selected date and the 6 days before it" },
  { id: "month", label: "30 days", title: "The selected date and the 29 days before it" },
  { id: "all", label: "Overall", title: "Every recorded date up to the selected date" },
];
const PERIOD_NAMES: Record<AnalyticsPeriod, string> = { day: "Single day", week: "Past week", month: "Past 30 days", all: "Overall" };
const PERIOD_OFFSET: Partial<Record<AnalyticsPeriod, number>> = { week: 6, month: 29 };
const AGE_GROUPS = ["Under 18", "18–59", "60+", "Unknown"];
const GUIDE_KEY = "veasna.analytics.guideDismissed";
const TONES = {
  slate: { dot: "bg-slate-500", active: "bg-slate-800 text-white", badge: "bg-slate-100 text-slate-700" },
  blue: { dot: "bg-blue-500", active: "bg-blue-600 text-white", badge: "bg-blue-100 text-blue-700" },
  rose: { dot: "bg-rose-500", active: "bg-rose-600 text-white", badge: "bg-rose-100 text-rose-700" },
  violet: { dot: "bg-violet-500", active: "bg-violet-600 text-white", badge: "bg-violet-100 text-violet-700" },
  teal: { dot: "bg-teal-500", active: "bg-teal-600 text-white", badge: "bg-teal-100 text-teal-700" },
};

const localDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const readable = (value: string, withYear = true) => new Date(value + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", ...(withYear && { year: "numeric" }) });
function dateRangeText(period: AnalyticsPeriod, date: string) {
  if (!date) return "";
  if (period === "day") return readable(date);
  if (period === "all") return `all dates up to ${readable(date)}`;
  const start = new Date(date + "T00:00:00");
  start.setDate(start.getDate() - (PERIOD_OFFSET[period] ?? 0));
  return `${readable(localDate(start), false)} – ${readable(date)}`;
}

function StatCard({ icon: Icon, label, value, detail, info, tone, delay }: {
  icon: ComponentType<{ className?: string }>; label: string; value: number; detail: string; info: string; tone: string; delay: number;
}) {
  return <article style={{ animationDelay: `${delay}ms` }}
    className={cn(panel, enter, "group border-t-[3px] transition duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none", tone.split(" ").find(name => name.startsWith("border-t-")))}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1"><h3 className="text-sm font-medium text-muted-foreground">{label}</h3><InfoTip label={label}>{info}</InfoTip></div>
      <span className={cn("grid size-9 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none", tone)} aria-hidden="true"><Icon className="size-4" /></span>
    </div>
    <p className="my-2 text-4xl font-semibold">{value}</p>
    <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
  </article>;
}

export default function AnalyticsDashboard() {
  const token = useUserStore(state => state.user?.token);
  const currentLocation = useLocationStore(state => state.currentLocation);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<AnalyticsLocation>(currentLocation?.id ?? 0);
  const [date, setDate] = useState(() => localDate());
  const [condition, setCondition] = useState("diabetes");
  const [period, setPeriod] = useState<AnalyticsPeriod>("day");
  const [data, setData] = useState<Analytics | null>(null);
  const [trend, setTrend] = useState<AnalyticsTrend | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

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

  // Storage can be unavailable (private windows, blocked site data); the guide then just shows.
  useEffect(() => {
    try { setShowGuide(localStorage.getItem(GUIDE_KEY) !== "1"); } catch { setShowGuide(true); }
  }, []);
  const dismissGuide = () => {
    setShowGuide(false);
    try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* Preference is optional. */ }
  };

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
  const conditionTotal = visible?.conditions?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const locationName = locationId === "all" ? "All locations" : locations.find(item => item.id === locationId)?.name ?? "Clinic";
  // Each section keeps one accent colour in the nav, its icon badge and its heading.
  const sections = [
    { id: "overview", label: "Summary", ...TONES.slate },
    { id: "trends", label: "Trends", ...TONES.blue },
    { id: "conditions", label: "Conditions", ...TONES.rose },
    ...(locationId === "all" ? [{ id: "locations", label: "Locations", ...TONES.violet }] : []),
    { id: "operations", label: "Clinic operations", ...TONES.teal },
  ];
  const sectionKey = sections.map(section => section.id).join();

  // Highlight the section currently in the middle of the screen.
  useEffect(() => {
    if (!visible || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const hit = entries.find(entry => entry.isIntersecting);
      if (hit) setActiveSection(hit.target.id);
    }, { rootMargin: "-35% 0px -60% 0px" });
    sectionKey.split(",").forEach(id => { const node = document.getElementById(id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [sectionKey, visible]);

  const jumpTo = (id: string) => {
    setActiveSection(id);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const onTrendLoaded = useCallback((result: AnalyticsTrend | null) => setTrend(result), []);
  const exportCsv = () => {
    if (!visible) return;
    const slug = locationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    downloadFile(buildAnalyticsCsv(visible, trend, { location: locationName, period: PERIOD_NAMES[period] }), `veasna-analytics-${slug}-${period}-${date}.csv`);
    toast.success("Spreadsheet downloaded");
  };

  const cards = visible ? [
    { icon: Users, label: "Patients reached", value: visible.summary.people, tone: "bg-blue-50 text-blue-700 border-t-blue-500",
      detail: `${visible.summary.visits} registered visits`, info: "Different people registered in this period. Someone who visits more than once is counted once." },
    { icon: Stethoscope, label: "Patients consulted", value: visible.summary.consultedPeople, tone: "bg-orange-50 text-orange-700 border-t-orange-500",
      detail: visible.summary.people ? `${Math.round(visible.summary.consultedPeople / visible.summary.people * 100)}% of patients reached` : "No patients yet",
      info: "Different people whose Consult station was marked complete. Saving notes alone does not count." },
    { icon: Send, label: "Visits with referrals", value: visible.summary.referralVisits, tone: "bg-violet-50 text-violet-700 border-t-violet-500",
      detail: "Saved referrals, including unsigned drafts", info: "Visits with a saved referral form, signed or not. It does not confirm the patient attended." },
    { icon: CheckCircle2, label: "Visits discharged", value: visible.summary.dischargedVisits, tone: "bg-emerald-50 text-emerald-700 border-t-emerald-500",
      detail: `${visible.summary.visits - visible.summary.dischargedVisits} still in the clinic queue`, info: "Visits marked discharged from the queue. Not every assigned station is necessarily complete." },
  ] : [];
  const reviewed = visible?.summary.conditionReviewedVisits ?? 0;
  const consulted = visible?.summary.consultedVisits ?? 0;

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md print:static print:border-0">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-8">
        <Link href="/" aria-label="Back to clinic" title="Back to clinic" className="group inline-flex h-8 shrink-0 items-center gap-1 rounded-full pl-2 pr-3 text-sm text-muted-foreground transition duration-200 hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none print:hidden">
          <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /> Back
        </Link>
        <span className="h-5 w-px bg-border print:hidden" aria-hidden="true" />
        <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate text-base font-semibold sm:text-lg">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm" aria-hidden="true"><BarChart3 className="size-4" /></span>
          <span className="truncate">Clinic analytics</span>
        </h1>
        <GlassButton type="button" size="icon" aria-label="Refresh data" title="Reload the latest saved data" className="group size-10 print:hidden" disabled={loading || !locationId || !date} onClick={() => setRefresh(value => value + 1)}>
          <RefreshCw className={cn("size-4 transition-transform duration-500", loading ? "animate-spin motion-reduce:animate-none" : "group-hover:rotate-90")} aria-hidden="true" />
        </GlassButton>
        <div className="print:hidden"><ExportMenu disabled={!visible} onCsv={exportCsv} onPrint={() => window.print()} /></div>
      </div>
      {visible && <nav aria-label="Page sections" className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2 sm:px-8 print:hidden">
        <ul className="flex gap-1">{sections.map(section => {
          const current = activeSection === section.id;
          return <li key={section.id}>
            <button type="button" onClick={() => jumpTo(section.id)} aria-current={current ? "location" : undefined}
              className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                current ? section.active : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <span className={cn("size-1.5 rounded-full", section.dot)} aria-hidden="true" />{section.label}
            </button>
          </li>;
        })}</ul>
      </nav>}
    </header>

    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-8">
      {showGuide && <aside aria-label="How to use this page" className={cn(enter, "flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 print:hidden")}>
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden="true" />
        <p className="flex-1 leading-6"><span className="font-semibold">How to use this page: </span>
          pick a location, period and date below, tap <Info className="inline size-3.5 align-[-2px]" aria-label="info" /> on any card to see what it means, and use the links above to jump between sections.</p>
        <button type="button" aria-label="Hide guide" onClick={dismissGuide} className="grid size-7 shrink-0 place-items-center rounded-full text-blue-700 transition hover:rotate-90 hover:bg-blue-100 active:scale-90 motion-reduce:transform-none">
          <X className="size-4" aria-hidden="true" />
        </button>
      </aside>}

      <section aria-label="Analytics filters" className={cn(panel, enter, "p-4 sm:p-5 print:hidden")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)] lg:items-end">
          <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">Clinic location
            <select aria-label="Clinic location" value={locationId} onChange={event => setLocationId(event.target.value === "all" ? "all" : Number(event.target.value))} className={cn(fieldClass, "text-foreground")}>
              {!locations.length && <option value={0}>{locationsLoaded ? "No locations available" : "Loading locations..."}</option>}
              {locations.length > 0 && <option value="all">All locations (overall)</option>}
              {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
          <div className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">Time period
            <Segmented label="Time period" value={period} onChange={setPeriod} options={PERIODS} className="w-full sm:w-auto" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-1">
            <label htmlFor="analytics-date">{period === "day" ? "Date" : "Up to date"}</label>
            <div className="flex gap-2">
              <input id="analytics-date" type="date" value={date} max={localDate()} onChange={event => setDate(event.target.value)} className={cn(fieldClass, "min-w-0 flex-1 text-foreground")} />
              {date !== localDate() && <button type="button" onClick={() => setDate(localDate())} className="h-10 shrink-0 rounded-lg border border-border px-3 text-sm text-foreground transition hover:bg-muted active:scale-95 animate-in fade-in duration-200 motion-reduce:animate-none">Today</button>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Showing</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-800"><MapPin className="size-3" aria-hidden="true" />{locationName}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-800"><CalendarDays className="size-3" aria-hidden="true" />{dateRangeText(period, date)}</span>
          <InfoTip label="filters">Every chart on this page uses these filters. Counts are based on the date each visit was registered, not population prevalence.</InfoTip>
          {visible && <span className="ml-auto">Updated {new Date(visible.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </section>

      <div aria-live="polite">
        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in duration-200">
          <span>{error}</span>
          <button type="button" onClick={() => setRefresh(value => value + 1)} className="rounded-full border border-destructive/30 px-3 py-1 font-medium transition hover:bg-destructive/10 active:scale-95">Try again</button>
        </div>}
        {!locationId && locationsLoaded && <p className="text-sm text-muted-foreground">No clinic locations could be loaded. Return to the clinic page to check the connection and location setup.</p>}
        {loading && !visible && <div role="status" aria-label="Loading clinic activity" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" style={{ animationDelay: `${i * 100}ms` }} />)}</div>
          <div className="h-80 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
        </div>}
      </div>

      {visible && <>
        {!visible.summary.visits && <div className={cn(enter, "flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-5")}>
          <CalendarX2 className="size-6 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">No visits are recorded for this location and period.</p>
            <p className="text-xs text-muted-foreground">Try a longer period or look across every location.</p></div>
          <div className="flex flex-wrap gap-2">
            {period !== "month" && period !== "all" && <button type="button" onClick={() => setPeriod("month")} className="rounded-full border border-border px-3 py-1.5 text-sm transition hover:bg-muted active:scale-95">Try past 30 days</button>}
            {locationId !== "all" && <button type="button" onClick={() => setLocationId("all")} className="rounded-full border border-border px-3 py-1.5 text-sm transition hover:bg-muted active:scale-95">Try all locations</button>}
          </div>
        </div>}

        <section id="overview" aria-label="Clinic activity" className="scroll-mt-36 space-y-3">
          <h2 className="sr-only">Summary</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, i) => <StatCard key={card.label} {...card} delay={i * 70} />)}
          </div>
        </section>

        {token && <TrendSection id="trends" locationId={locationId} date={date} token={token} refresh={refresh} onLoaded={onTrendLoaded} delay={150} />}

        <SectionCard id="conditions" icon={HeartPulse} tone={TONES.rose.badge} title="Conditions seen in consultation" label="Condition analytics" delay={200}
          description="Based on the condition categories doctors tick at the Consult station."
          info="Each patient counts once per condition in this period, but can appear under several conditions. Consultations where no categories were saved are not treated as 'no condition'.">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Conditions addressed in consultation</h3>
                <p className="mt-1 text-xs text-muted-foreground">Pick a condition, or tap one in the chart.</p>
              </div>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Condition
                <select aria-label="Condition" value={condition} onChange={event => setCondition(event.target.value)} className={cn(fieldClass, "text-foreground")}>
                  {CONSULTATION_CONDITIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <div key={condition} className="rounded-xl bg-muted/50 p-4 animate-in fade-in slide-in-from-left-1 duration-300 motion-reduce:animate-none">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: CONDITION_COLORS[condition] }} aria-hidden="true" />
                  Patients consulted with {CONSULTATION_CONDITIONS.find(item => item.id === condition)?.label.toLowerCase()}
                </p>
                <p className="mt-2 text-4xl font-semibold">{consulted > 0 && reviewed === 0 ? "Not recorded" : (visible.conditions?.find(item => item.id === condition)?.count ?? 0)}</p>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>Consultations with conditions recorded</span><span className="tabular-nums">{reviewed} of {consulted}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Consultations with conditions recorded" aria-valuemin={0} aria-valuemax={consulted} aria-valuenow={reviewed}>
                  <div className="bar-grow h-full rounded-full bg-emerald-600" style={{ width: `${consulted ? reviewed / consulted * 100 : 0}%` }} />
                </div>
              </div>
              {reviewed < consulted && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Incomplete condition data: some consultations have not been classified. Counts reflect recorded selections only.</p>}
            </div>
            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-2"><PieChart className="size-4 text-muted-foreground" aria-hidden="true" /><h3 className="text-sm font-medium">Condition mix</h3>
                <InfoTip label="Condition mix">Each slice is that condition&apos;s share of all conditions ticked in this period. A patient with two conditions adds to both slices.</InfoTip></div>
              {conditionTotal > 0
                ? <DonutChart caption="Condition mix for the selected period" centerLabel="conditions ticked" selected={condition} onSelect={setCondition}
                    items={visible.conditions.map(item => ({ ...item, color: CONDITION_COLORS[item.id] }))} />
                : <p className="grid h-48 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">No conditions recorded for this period.</p>}
            </div>
          </div>
        </SectionCard>

        {locationId === "all" && <SectionCard id="locations" icon={MapPin} tone={TONES.violet.badge} title="Patients reached by location" label="Location comparison" delay={250}
          description="Compare how many different patients each clinic location saw."
          info="A patient seen at two locations counts at both, so these can add up to more than Patients reached.">
          {visible.locations.length
            ? <BarList color={PRIMARY_SERIES_COLOR} unit="patients" items={visible.locations.map(row => ({
                id: String(row.locationId), label: locations.find(item => item.id === row.locationId)?.name ?? `Location ${row.locationId}`,
                value: row.people, detail: `${row.visits} visits`,
              }))} />
            : <p className="text-sm text-muted-foreground">No visits recorded at any location.</p>}
        </SectionCard>}

        <section id="operations" aria-label="Clinic operations" className="scroll-mt-36 space-y-4">
          <div className={cn(enter, "flex items-center gap-2 pt-2")} style={{ animationDelay: "250ms" }}>
            <span className={cn("grid size-7 place-items-center rounded-lg", TONES.teal.badge)} aria-hidden="true"><Activity className="size-4" /></span><h2 className="text-lg font-semibold">Clinic operations</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard icon={ClipboardCheck} tone={TONES.teal.badge} title="Station workload" delay={300}
              description="How many visits each station has, has finished, and is serving now."
              info="Counts visits, not people. Waiting means the visit is currently at this station. Reopening a station puts it back to pending.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[22rem] text-left text-sm">
                  <thead className="text-xs text-muted-foreground"><tr><th className="pb-3 font-medium">Station</th><th className="pb-3 text-right font-medium">Assigned</th><th className="pb-3 text-right font-medium">Completed</th><th className="pb-3 text-right font-medium">Waiting</th></tr></thead>
                  <tbody>{STATIONS.map(station => {
                    const row = visible.stations.find(item => item.station === station.id);
                    return <tr key={station.id} className="border-t border-border transition-colors hover:bg-muted/50">
                      <th className="py-3 font-medium">{station.label}</th>
                      <td className="text-right tabular-nums">{row?.assigned ?? 0}</td>
                      <td className="text-right tabular-nums">{row?.completed ?? 0}</td>
                      <td className="text-right tabular-nums">{row?.waiting ? <span className="inline-flex min-w-6 justify-center rounded-full bg-amber-100 px-2 font-medium text-amber-900">{row.waiting}</span> : 0}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </SectionCard>
            <SectionCard icon={Users} tone={TONES.teal.badge} title="Who we reached" delay={350}
              description="Different patients by age group." info="Age is worked out on the selected date. Missing or future birth dates are shown as Unknown.">
              <BarList color={PRIMARY_SERIES_COLOR} unit="patients" items={AGE_GROUPS.map(label => {
                const count = visible.ages.find(item => item.label === label)?.count ?? 0;
                return { id: label, label, value: count, detail: visible.summary.people ? `${Math.round(count / visible.summary.people * 100)}%` : undefined };
              })} />
            </SectionCard>
            <SectionCard icon={Send} tone={TONES.teal.badge} title="Referral destinations" delay={400}
              description="Where patients were referred." info="A visit can be referred to several places, so these can add up to more than the number of referrals.">
              {visible.destinations.length
                ? <BarList color={PRIMARY_SERIES_COLOR} unit="visits" items={visible.destinations.map(item => ({ id: item.label, label: item.label, value: item.count }))} />
                : <p className="text-sm text-muted-foreground">No referral destinations recorded.</p>}
            </SectionCard>
            <SectionCard icon={FileWarning} tone={TONES.teal.badge} title="Documentation check" delay={450}
              description="Records that may need a second look." info="These are prompts for review, not measures of clinical quality. Saved notes do not necessarily mean a consultation is complete.">
              <dl className="space-y-1 text-sm">
                {[
                  ["Visits with non-empty consultation notes", visible.summary.notesSaved, false],
                  ["Unsigned saved referrals", visible.summary.unsignedReferrals, true],
                  ["Patients with unknown or future birth dates", visible.ages.find(item => item.label === "Unknown")?.count ?? 0, true],
                ].map(([label, value, flag]) => <div key={String(label)} className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
                  <dt>{label}</dt>
                  <dd className={cn("tabular-nums", flag && Number(value) > 0 && "rounded-full bg-amber-100 px-2 font-medium text-amber-900")}>{value}</dd>
                </div>)}
              </dl>
            </SectionCard>
          </div>
        </section>
      </>}
    </main>
  </div>;
}
