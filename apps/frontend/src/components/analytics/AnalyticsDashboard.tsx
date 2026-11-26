"use client";

import { PRIMARY_SERIES_COLOR, conditionColor } from "@/constants/consultationConditions";
import { useFormOptions } from "@/stores/useFormOptionsStore";
import { ComponentType, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  CalendarDays, CalendarX2, CheckCircle2, ClipboardCheck, FileWarning, HeartPulse, Info, Lightbulb, MapPin, PieChart, Printer,
  RefreshCw, Send, Stethoscope, Users, X,
} from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { getAnalytics, Analytics, AnalyticsPeriod, AnalyticsTrend } from "@/lib/api/analytics";
import { can } from "@/lib/permissions";
import { STATIONS } from "@/constants/stations";
import { letterheadLogoUrl } from "@/constants/letterhead";
import { writeAndPrint } from "@/lib/printDocument";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StationMark } from "@/components/shared/StationBadge";
import PrintReferralsDialog from "@/components/shared/PrintReferralsDialog";
import { BarList, DonutChart } from "./charts";
import TrendSection from "./TrendSection";
import ReferralListsSection from "./ReferralListsSection";
import FollowUpSection from "./FollowUpSection";
import PartnerNgoSection from "./PartnerNgoSection";
import OpticianSection from "./OpticianSection";
import { buildAnalyticsCsv, downloadFile } from "./exportCsv";
import { analyticsReportDocumentHtml } from "./analyticsReportDocument";
import { daysCovered, periodRangeText, readableDate } from "./dates";
import { enter, ExportMenu, fieldClass, InfoTip, Meter, panel, Segmented, SectionCard, SECTION_SCROLL } from "./ui";
import { hostToday, isoDate } from "@/stores/useHostClockStore";

const PERIODS: { id: AnalyticsPeriod; label: string; title: string }[] = [
  { id: "day", label: "Day", title: "Selected date only" },
  { id: "week", label: "Week", title: "Last 7 days" },
  { id: "month", label: "30 days", title: "Last 30 days" },
  { id: "trip", label: "This trip", title: "Clinic days of this trip" },
  { id: "all", label: "Overall", title: "All dates so far" },
];
const PERIOD_NAMES: Record<AnalyticsPeriod, string> = { day: "Single day", week: "Past week", month: "Past 30 days", trip: "This trip", all: "Overall" };
const PERIOD_OFFSET: Partial<Record<AnalyticsPeriod, number>> = { week: 6, month: 29 };
const AGE_GROUPS = ["Under 18", "18–59", "60+", "Unknown"];
const GUIDE_KEY = "veasna.analytics.guideDismissed";
const SECTIONS = [
  { id: "overview", label: "Summary" },
  { id: "follow-up", label: "Follow-up" },
  { id: "trends", label: "Trends" },
  { id: "conditions", label: "Conditions" },
  { id: "referrals", label: "Referrals" },
  { id: "partner-ngo", label: "Partner NGO" },
  { id: "optician", label: "Optician" },
  { id: "operations", label: "Clinic operations" },
];

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const isPeriod = (value: string | null): value is AnalyticsPeriod => PERIODS.some(item => item.id === value);
const isDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

// The first date of a rolling period, worked out here while the host's answer loads (a trip's
// start comes only from the host).
function localStart(period: AnalyticsPeriod, date: string): string | null {
  if (period === "day") return date;
  if (period === "all" || period === "trip") return null;
  const start = new Date(date + "T00:00:00");
  start.setDate(start.getDate() - (PERIOD_OFFSET[period] ?? 0));
  return isoDate(start);
}

// The filters live in the address (?period=&date=) so a view can be bookmarked, shared on the LAN
// or reloaded. Read from window.location, not useSearchParams, so the page needs no Suspense.
function readUrlFilters(): { period?: AnalyticsPeriod; date?: string } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const period = params.get("period"), date = params.get("date");
  return { ...(isPeriod(period) && { period }), ...(isDate(date) && date <= hostToday() && { date }) };
}

/** One sentence for the whole period, e.g. "On 18 Nov 2026, 42 patients were reached and 30 consulted; …". */
export function headlineSentence(data: Analytics, period: AnalyticsPeriod, live: boolean, range: string): string {
  const s = data.summary;
  const clinicDays = data.days?.length ?? 0;
  const when = period === "day" ? (live ? "Today" : `On ${range}`)
    : period === "trip" ? `This trip (${range}${clinicDays > 1 ? `, ${clinicDays} clinic days` : ""})`
    : period === "all" ? "Across all dates" : `From ${range}`;
  const open = s.visits - s.dischargedVisits;
  const parts = [
    `${when}, ${plural(s.people, "patient")} ${s.people === 1 ? "was" : "were"} reached and ${s.consultedPeople} consulted`,
    `${plural(s.referralVisits, "visit")} ${s.referralVisits === 1 ? "has" : "have"} a referral${s.unsignedReferrals ? ` (${s.unsignedReferrals} unsigned)` : ""}`,
    open ? (live ? `${open} still in the clinic` : `${plural(open, "visit")} not discharged`) : "every visit was discharged",
  ];
  return `${parts[0]}; ${parts[1]}; ${parts[2]}.`;
}

// The headline with its numbers in semibold, and its last clause (who is still open) in Caution
// Amber ink, or Done Green when every visit was discharged. The words say the same without colour.
function Headline({ text, live }: { text: string; live: boolean }) {
  const clauses = text.replace(/\.$/, "").split("; ");
  const last = clauses.pop() ?? "";
  // Counts in semibold; dates and notes in brackets, e.g. "(17 – 18 Nov 2026)", stay plain.
  const numbers = (part: string) => part.split(/(\([^)]*\))/).flatMap((chunk, c) => c % 2 ? [chunk]
    : chunk.split(/(\d+)/).map((piece, i) => i % 2 ? <span key={`${c}-${i}`} className="font-semibold tabular-nums">{piece}</span> : piece));
  const allDone = last.startsWith("every visit");
  return <p className={cn(enter, "max-w-4xl text-lg leading-7")}>
    {clauses.map((clause, i) => <span key={i}>{numbers(clause)}; </span>)}
    <span className={allDone ? "text-success-ink" : live ? "text-warning-ink" : "text-foreground"}>{numbers(last)}</span>.
  </p>;
}

function StatCard({ icon: Icon, label, value, detail, info, delay, action, meter, detailTone }: {
  icon: ComponentType<{ className?: string }>; label: string; value: number; detail: ReactNode; info: string; delay: number;
  action?: { label: string; icon: ComponentType<{ className?: string }>; onClick: () => void };
  // The value's share of a whole, as a split bar under it.
  meter?: { parts: { value: number; className: string }[]; total: number };
  detailTone?: string;
}) {
  const ActionIcon = action?.icon;
  return <article style={{ animationDelay: `${delay}ms` }} className={cn(panel, enter, "flex flex-col")}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1"><h3 className="text-sm font-medium text-muted-foreground">{label}</h3><InfoTip label={label}>{info}</InfoTip></div>
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
    </div>
    <p className="my-2 text-3xl font-semibold tabular-nums">{value}</p>
    {meter && <Meter {...meter} className="mb-2" />}
    <p className={cn("text-xs leading-5", detailTone ?? "text-muted-foreground")}>{detail}</p>
    {action && ActionIcon && <div className="mt-auto pt-3 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={action.onClick}><ActionIcon aria-hidden="true" />{action.label}</Button>
    </div>}
  </article>;
}

export default function AnalyticsDashboard() {
  const token = useUserStore(state => state.user?.token);
  // Printing referral letters from here also needs "Print and download"; without it the button is not shown.
  const canPrint = useUserStore(state => can(state.user, "print"));
  const [date, setDate] = useState(() => readUrlFilters().date ?? hostToday());
  const conditions = useFormOptions("consultation_conditions");
  const [chosenCondition, setCondition] = useState("diabetes");
  // Falls back to the first listed condition if the chosen one was removed on the Station data page.
  const condition = conditions.some(item => item.id === chosenCondition) ? chosenCondition : conditions[0]?.id ?? "";
  const [period, setPeriod] = useState<AnalyticsPeriod>(() => readUrlFilters().period ?? "day");
  const [data, setData] = useState<Analytics | null>(null);
  const [trend, setTrend] = useState<AnalyticsTrend | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [printingReferrals, setPrintingReferrals] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  // Storage can be unavailable (private windows, blocked site data); the guide then just shows.
  useEffect(() => {
    try { setShowGuide(localStorage.getItem(GUIDE_KEY) !== "1"); } catch { setShowGuide(true); }
  }, []);
  const dismissGuide = () => {
    setShowGuide(false);
    try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* Preference is optional. */ }
  };

  // Keep the address in step with the filters (replace, so Back still leaves the page).
  useEffect(() => {
    if (typeof window === "undefined" || !window.history?.replaceState) return;
    const url = new URL(window.location.href);
    url.searchParams.set("period", period);
    if (date === hostToday()) url.searchParams.delete("date"); else url.searchParams.set("date", date);
    // State null, not Next's own: Next then adopts the new address instead of restoring its old one later.
    window.history.replaceState(null, "", url.toString());
  }, [period, date]);

  // The previous numbers stay on screen, dimmed, while new filters load, so the page doesn't jump.
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    if (!date || !token) { setLoading(false); return; }
    setLoading(true);
    getAnalytics(date, token, controller.signal, period)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load analytics."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, token, refresh, period]);

  const current = data?.date === date && (data.period ?? "day") === period;
  // After a failed load the old numbers are not shown: they would read as the new period's.
  const shown = error ? null : data;
  const live = period === "day" && date === hostToday();
  const openLabel = live ? "Waiting" : "Not discharged";
  const range = periodRangeText(period, current && data ? data.startDate : localStart(period, date), date)
    || (period === "trip" ? `the trip up to ${readableDate(date)}` : "");
  const conditionTotal = shown?.conditions?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const hasVisits = !!shown?.summary.visits;

  // Highlight the section in the upper part of the page's scroll area; Summary at the very top and
  // the last section at the very bottom, where the middle band never reaches them.
  useEffect(() => {
    const scroller = pageRef.current?.closest("main") ?? null;
    if (!hasVisits || !scroller || typeof IntersectionObserver === "undefined") return;
    const edge = () => scroller.scrollTop < 32 ? SECTIONS[0].id
      : scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4 ? SECTIONS[SECTIONS.length - 1].id : null;
    const observer = new IntersectionObserver(entries => {
      const hit = entries.find(entry => entry.isIntersecting);
      const id = edge() ?? hit?.target.id;
      if (id) setActiveSection(id);
    }, { root: scroller, rootMargin: "-25% 0px -65% 0px" });
    SECTIONS.forEach(({ id }) => { const node = document.getElementById(id); if (node) observer.observe(node); });
    const onScroll = () => { const id = edge(); if (id) setActiveSection(id); };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => { observer.disconnect(); scroller.removeEventListener("scroll", onScroll); };
  }, [hasVisits]);

  const jumpTo = (id: string) => {
    setActiveSection(id);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const onTrendLoaded = useCallback((result: AnalyticsTrend | null) => setTrend(result), []);
  const exportCsv = () => {
    if (!shown || !current) return;
    downloadFile(buildAnalyticsCsv(shown, trend, { period: PERIOD_NAMES[period], openLabel }, conditions), `veasna-analytics-${period}-${date}.csv`);
    toast.success("Spreadsheet downloaded");
  };
  const printReport = () => {
    if (!shown || !current) return;
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Allow pop-ups to print the report."); return; }
    writeAndPrint(popup, analyticsReportDocumentHtml(shown, {
      periodName: PERIOD_NAMES[period], dateRange: range, headline: headlineSentence(shown, period, live, range),
      openLabel, conditions, logoUrl: letterheadLogoUrl(),
    }));
  };

  const cards = shown ? [
    { icon: Users, label: "Patients reached", value: shown.summary.people,
      detail: `${plural(shown.summary.visits, "registered visit")}`, info: "Different people registered in this period. Someone who visits more than once is counted once." },
    { icon: Stethoscope, label: "Patients consulted", value: shown.summary.consultedPeople,
      detail: shown.summary.people ? `${Math.round(shown.summary.consultedPeople / shown.summary.people * 100)}% of patients reached` : "No patients yet",
      meter: { total: shown.summary.people, parts: [{ value: shown.summary.consultedPeople, className: "bg-primary" }] },
      info: "Different people whose Consult station was marked complete. Saving notes alone does not count." },
    { icon: Send, label: "Visits with referrals", value: shown.summary.referralVisits,
      detail: shown.summary.unsignedReferrals ? `Including ${shown.summary.unsignedReferrals} unsigned` : shown.summary.referralVisits ? "All signed" : "None saved",
      detailTone: shown.summary.unsignedReferrals ? "font-medium text-warning-ink" : undefined,
      meter: { total: shown.summary.referralVisits, parts: [
        { value: shown.summary.referralVisits - shown.summary.unsignedReferrals, className: "bg-primary" },
        { value: shown.summary.unsignedReferrals, className: "bg-warning" }] },
      info: "Visits with a saved referral form, signed or not. A referral can name several destinations, so the destination lists below can add up to more. It does not confirm the patient attended.",
      action: canPrint ? { label: "Print referral letters", icon: Printer, onClick: () => setPrintingReferrals(true) } : undefined },
    { icon: CheckCircle2, label: "Visits discharged", value: shown.summary.dischargedVisits,
      detail: `${shown.summary.visits - shown.summary.dischargedVisits} ${live ? "still in the clinic" : "not discharged"}`,
      detailTone: live && shown.summary.visits > shown.summary.dischargedVisits ? "font-medium text-warning-ink" : undefined,
      meter: { total: shown.summary.visits, parts: [
        { value: shown.summary.dischargedVisits, className: "bg-success" },
        { value: shown.summary.visits - shown.summary.dischargedVisits, className: live ? "bg-warning" : "bg-muted-foreground/40" }] },
      info: live ? "Visits marked discharged from the queue. The rest are still in the clinic today."
        : "Visits discharged from the queue, including those discharged automatically when their day ended." },
  ] : [];
  const reviewed = shown?.summary.conditionReviewedVisits ?? 0;
  const consulted = shown?.summary.consultedVisits ?? 0;
  const days = shown?.days ?? [];
  const maxDayPeople = Math.max(1, ...days.map(day => day.people));

  const workload = shown && <SectionCard icon={ClipboardCheck} title="Station workload" delay={live ? 120 : 300}
    description={live ? "How many visits each station has, has finished, and is serving now." : "How many visits each station had, finished, and left open."}
    info={<>Counts visits, not people. {live ? "Waiting means the visit is at this station now." : "Not discharged means the visit was still at this station when it was left open."} Reopening a station puts it back to pending.</>}>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-left text-sm">
        <thead className="text-xs text-muted-foreground"><tr><th className="pb-3 font-medium">Station</th><th className="pb-3 text-right font-medium">Assigned</th><th className="pb-3 text-right font-medium">Completed</th><th className="pb-3 text-right font-medium">{openLabel}</th></tr></thead>
        <tbody>{STATIONS.map(station => {
          const row = shown.stations.find(item => item.station === station.id);
          return <tr key={station.id} className="border-t border-border">
            <th className="py-2.5 font-medium">
              <span className="flex items-center gap-2.5">
                <StationMark station={station.id} className="size-6" />{station.label}
                {station.id === "pharmacy" && <InfoTip label="Pharmacy">Added when the doctor prescribes at Consult, so only patients with a prescription are assigned. Completed once every prescription is given out.</InfoTip>}
              </span>
            </th>
            <td className="text-right tabular-nums">{row?.assigned ?? 0}</td>
            <td className="text-right tabular-nums">
              {/* How much of the station's work is done, in Done Green. */}
              <span className="inline-flex items-center justify-end gap-3">
                {row?.assigned ? <Meter className="hidden w-20 sm:flex" total={row.assigned} parts={[{ value: row.completed, className: "bg-success" }]} /> : null}
                {row?.completed ?? 0}
              </span>
            </td>
            <td className="text-right tabular-nums">{row?.waiting ? <span className="inline-flex min-w-6 justify-center rounded-full bg-warning-tint px-2 font-medium text-warning-ink">{row.waiting}</span> : 0}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </SectionCard>;

  return <div ref={pageRef} className="flex flex-col gap-5 pb-8 text-foreground">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold">Clinic analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Totals for a day, a week, a trip or all time, and who still needs follow-up.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Refresh data" title="Reload data" className="group size-10" disabled={loading || !date} onClick={() => setRefresh(value => value + 1)}>
          <RefreshCw className={cn("size-4 transition-transform duration-500", loading ? "animate-spin motion-reduce:animate-none" : "group-hover:rotate-90")} aria-hidden="true" />
        </Button>
        <ExportMenu disabled={!shown || !current} onCsv={exportCsv} onPrint={printReport} />
      </div>
    </header>

    {/* Filters and section links stay in reach while the page scrolls (main is the scroll area). */}
    <div className="sticky -top-5 z-20 -mx-6 border-b border-border bg-background/95 px-6 pb-3 pt-4 backdrop-blur-md">
      <section aria-label="Analytics filters" className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">Time period
          <Segmented label="Time period" value={period} onChange={setPeriod} options={PERIODS} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <label htmlFor="analytics-date">{period === "day" ? "Date" : "Up to date"}</label>
          <div className="flex gap-2">
            <input id="analytics-date" type="date" value={date} max={hostToday()} onChange={event => { if (event.target.value) setDate(event.target.value); }} className={cn(fieldClass, "min-w-0 text-foreground")} />
            {date !== hostToday() && <Button type="button" variant="outline" className="h-10" onClick={() => setDate(hostToday())}>Today</Button>}
          </div>
        </div>
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pb-2 text-xs text-muted-foreground">
          {/* The date field already says which day; longer periods spell out their dates. */}
          {period !== "day" && <><CalendarDays className="size-3.5" aria-hidden="true" />
            <span className="font-medium text-foreground">{range}</span></>}
          <InfoTip label="filters">Every number, chart and list on this page covers these dates, counted by the date each visit was registered. The trend chart also shows the days around a single day or week for context. Counts are of patients seen, not prevalence in the population.</InfoTip>
          {shown && current && <span className="ml-auto">Updated {new Date(shown.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
        </p>
      </section>
      {hasVisits && <nav aria-label="Page sections" className="mt-3 overflow-x-auto">
        <ul className="flex gap-1">{SECTIONS.map(section => {
          const here = activeSection === section.id;
          return <li key={section.id}>
            <button type="button" onClick={() => jumpTo(section.id)} aria-current={here ? "location" : undefined}
              className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                here ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
              {section.label}
            </button>
          </li>;
        })}</ul>
      </nav>}
    </div>

    {showGuide && <aside aria-label="How to use this page" className={cn(enter, "flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm")}>
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 leading-6"><span className="font-semibold">How to use this page: </span>
        pick a period and date above, tap <Info className="inline size-3.5 align-[-2px]" aria-label="info" /> on any card to see what it means, and use the links above to jump between sections. Export prints a one-page report.</p>
      <Button type="button" variant="ghost" size="icon" aria-label="Hide guide" onClick={dismissGuide} className="size-7 shrink-0 text-primary">
        <X className="size-4" aria-hidden="true" />
      </Button>
    </aside>}

    <div aria-live="polite">
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in duration-200">
        <span>{error}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setRefresh(value => value + 1)}>Try again</Button>
      </div>}
      {loading && !shown && !error && <div role="status" aria-label="Loading clinic activity" className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" style={{ animationDelay: `${i * 100}ms` }} />)}</div>
        <div className="h-80 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      </div>}
    </div>

    {shown && !hasVisits && <div className={cn(enter, "flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-border bg-card/60 p-5", !current && "opacity-60")}>
      <CalendarX2 className="size-6 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">No visits are recorded for {range}.</p>
        <p className="text-xs text-muted-foreground">Try a longer period or another date.</p></div>
      <div className="flex flex-wrap gap-2">
        {period !== "month" && period !== "all" && <Button type="button" variant="outline" size="sm" onClick={() => setPeriod("month")}>Try past 30 days</Button>}
        {period !== "all" && <Button type="button" variant="outline" size="sm" onClick={() => setPeriod("all")}>Try all time</Button>}
      </div>
    </div>}

    {shown && hasVisits && <div className={cn("flex flex-col gap-5 transition-opacity duration-200", !current && "opacity-60")} aria-busy={!current}>
      <section id="overview" aria-label="Clinic activity" className={cn(SECTION_SCROLL, "space-y-4")}>
        <h2 className="sr-only">Summary</h2>
        <Headline text={headlineSentence(shown, period, live, range)} live={live} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, i) => <StatCard key={card.label} {...card} delay={i * 70} />)}
          {canPrint && <PrintReferralsDialog open={printingReferrals} onOpenChange={setPrintingReferrals}
            choices={["today", "date", "period", "all"]} initialDate={date} />}
        </div>
        {/* While the clinic is open, the stations come first: where patients are waiting now. */}
        {live && workload}
        {days.length > 1 && <SectionCard icon={MapPin} title="By clinic day" delay={140}
          description={`${plural(days.length, "clinic day")} in this period${period === "trip" && data?.startDate ? `, over ${plural(daysCovered(data.startDate, date), "calendar day")}` : ""}, with the screening-day account (named for the village) used on each.`}
          info="Patients are counted once per day, so someone seen on two days appears on both and the rows can add up to more than Patients reached. Each bar is that day's patients against the busiest day; the darker part was consulted.">
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="sticky top-0 bg-card text-xs text-muted-foreground"><tr>
                <th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Village account</th>
                <th className="pb-3 text-right font-medium">Patients</th><th className="pb-3 text-right font-medium">Consulted</th><th className="pb-3 text-right font-medium">Referrals</th>
              </tr></thead>
              <tbody>{days.map(day => <tr key={day.date} className="border-t border-border">
                <th className="py-2.5 font-medium">{readableDate(day.date)}</th>
                <td className="text-muted-foreground">{day.accounts.join(", ") || "–"}</td>
                <td className="text-right tabular-nums">
                  <span className="inline-flex items-center justify-end gap-3">
                    <Meter className="hidden w-24 sm:flex" total={maxDayPeople} parts={[{ value: day.consultedPeople, className: "bg-primary" }, { value: day.people - day.consultedPeople, className: "bg-primary/35" }]} />
                    {day.people}
                  </span>
                </td>
                <td className="text-right tabular-nums">{day.consultedPeople}</td>
                <td className="text-right tabular-nums">{day.referralVisits}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </SectionCard>}
      </section>

      {token && <FollowUpSection id="follow-up" date={date} period={period} live={live} token={token} refresh={refresh} delay={150} />}

      {token && <TrendSection id="trends" date={date} period={period} token={token} refresh={refresh} onLoaded={onTrendLoaded} delay={175} />}

      <SectionCard id="conditions" icon={HeartPulse} title="Conditions seen in consultation" label="Condition analytics" delay={200}
        description="Based on the condition categories doctors tick at the Consult station."
        info="Each patient counts once per condition in this period, but can appear under several conditions. A consultation counts as recorded once a category or None is ticked; one with nothing ticked is not treated as 'no condition'.">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Conditions addressed in consultation</h3>
              <p className="mt-1 text-xs text-muted-foreground">Pick a condition, or tap one in the chart.</p>
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Condition
              <select aria-label="Condition" value={condition} onChange={event => setCondition(event.target.value)} className={cn(fieldClass, "text-foreground")}>
                {conditions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <div key={condition} className="rounded-lg bg-muted/50 p-4 animate-in fade-in duration-300 motion-reduce:animate-none">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="size-2.5 rounded-full" style={{ background: conditionColor(condition, conditions) }} aria-hidden="true" />
                Patients consulted with {conditions.find(item => item.id === condition)?.label.toLowerCase()}
              </p>
              {consulted > 0 && reviewed === 0
                ? <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Not recorded</span>: no consultation in this period has conditions ticked yet.</p>
                : <p className="mt-2 text-3xl font-semibold tabular-nums">{shown.conditions?.find(item => item.id === condition)?.count ?? 0}</p>}
            </div>
            <div>
              <div className="mb-1.5 flex justify-between gap-3 text-xs text-muted-foreground"><span>Consultations with conditions recorded (None counts)</span><span className="shrink-0 tabular-nums">{reviewed} of {consulted}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Consultations with conditions recorded" aria-valuemin={0} aria-valuemax={consulted} aria-valuenow={reviewed}>
                <div className="bar-grow h-full rounded-full bg-primary" style={{ width: `${consulted ? reviewed / consulted * 100 : 0}%` }} />
              </div>
            </div>
            {reviewed < consulted && <p className="rounded-lg border border-warning-line bg-warning-soft p-3 text-xs leading-5 text-warning-ink">Incomplete condition data: {consulted - reviewed} of {consulted} consultations have nothing ticked. Counts reflect recorded selections only.</p>}
          </div>
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2"><PieChart className="size-4 text-muted-foreground" aria-hidden="true" /><h3 className="text-sm font-medium">Condition mix</h3>
              <InfoTip label="Condition mix">Each slice is that condition&apos;s share of all conditions ticked in this period. A patient with two conditions adds to both slices, so the total is selections, not patients.</InfoTip></div>
            {conditionTotal > 0
              ? <DonutChart caption="Condition mix for the selected period" centerLabel="conditions ticked" selected={condition} onSelect={setCondition}
                  items={shown.conditions.map(item => ({ ...item, color: conditionColor(item.id, conditions) }))} />
              : <p className="grid h-48 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">No conditions recorded for this period.</p>}
          </div>
        </div>
      </SectionCard>

      {token && <ReferralListsSection id="referrals" icon={Send}
        date={date} period={period} dateRange={range} token={token} refresh={refresh} delay={225} />}

      {token && <PartnerNgoSection id="partner-ngo" token={token} refresh={refresh} delay={250} />}

      {token && <OpticianSection id="optician" date={date} period={period} token={token} refresh={refresh} delay={275} />}

      <section id="operations" aria-label="Clinic operations" className={cn(SECTION_SCROLL, "grid gap-5 lg:grid-cols-2")}>
        <h2 className="sr-only">Clinic operations</h2>
        {!live && workload}
        <SectionCard icon={Users} title="Who we reached" delay={350}
          description="Different patients by age group." info="Age is worked out on the selected date. Missing or future birth dates are shown as Unknown.">
          <BarList color={PRIMARY_SERIES_COLOR} unit="patients" items={AGE_GROUPS.map(label => {
            const count = shown.ages.find(item => item.label === label)?.count ?? 0;
            return { id: label, label, value: count, detail: shown.summary.people ? `${Math.round(count / shown.summary.people * 100)}%` : undefined };
          })} />
        </SectionCard>
        <SectionCard icon={FileWarning} title="Documentation check" delay={400} className={live ? undefined : "lg:col-span-2"}
          description="Records that may need a second look." info="These are prompts for review, not measures of clinical quality. Saved notes do not necessarily mean a consultation is complete. Unsigned referrals are named under Needs follow-up.">
          <dl className="space-y-1 text-sm">
            {([
              ["Visits with non-empty consultation notes", shown.summary.notesSaved, false],
              ["Unsigned saved referrals", shown.summary.unsignedReferrals, true],
              ["Patients with unknown or future birth dates", shown.ages.find(item => item.label === "Unknown")?.count ?? 0, true],
            ] as const).map(([label, value, flag]) => <div key={label} className="flex items-center justify-between gap-4 rounded-md px-2 py-2">
              <dt>{label}</dt>
              <dd className={cn("tabular-nums", flag && value > 0 && "rounded-full bg-warning-tint px-2 font-medium text-warning-ink")}>{value}</dd>
            </div>)}
          </dl>
        </SectionCard>
      </section>
    </div>}
  </div>;
}
