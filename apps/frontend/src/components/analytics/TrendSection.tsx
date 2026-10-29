"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { AnalyticsLocation, AnalyticsTrend, getAnalyticsTrend, TrendBucket, TrendRange } from "@/lib/api/analytics";
import { CONDITION_COLORS, CONSULTATION_CONDITIONS, PRIMARY_SERIES_COLOR, SECONDARY_SERIES_COLOR } from "@/constants/consultationConditions";
import { ChartSeries, LineChart } from "./charts";
import { fieldClass, Segmented, SectionCard } from "./ui";

const RANGES: { id: TrendRange; label: string; title: string; unit: string }[] = [
  { id: "7d", label: "7 days", title: "Last 7 days, one point per day", unit: "day" },
  { id: "30d", label: "30 days", title: "Last 30 days, one point per day", unit: "day" },
  { id: "12w", label: "12 weeks", title: "Last 12 weeks, one point per week", unit: "week" },
  { id: "12m", label: "12 months", title: "Last 12 months, one point per month", unit: "month" },
];

const shortDate = (value: string, options: Intl.DateTimeFormatOptions) => new Date(value + "T00:00:00").toLocaleDateString(undefined, options);
const dayMonth = (value: string) => shortDate(value, { day: "numeric", month: "short" });
// Axis labels stay short; tooltips and the table show the full bucket range.
function bucketLabels(bucket: TrendBucket, range: TrendRange) {
  if (range === "12m") return { axis: shortDate(bucket.startDate, { month: "short" }), full: shortDate(bucket.startDate, { month: "long", year: "numeric" }) };
  if (range === "12w") return { axis: dayMonth(bucket.startDate), full: `${dayMonth(bucket.startDate)} – ${dayMonth(bucket.endDate)}` };
  return { axis: dayMonth(bucket.startDate), full: shortDate(bucket.startDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) };
}

function seriesFor(metric: string, buckets: TrendBucket[]): ChartSeries[] {
  if (metric === "patients") return [
    { id: "people", label: "Patients reached", color: PRIMARY_SERIES_COLOR, values: buckets.map(b => b.people) },
    { id: "consulted", label: "Patients consulted", color: SECONDARY_SERIES_COLOR, values: buckets.map(b => b.consultedPeople) },
  ];
  const conditions = metric === "conditions" ? CONSULTATION_CONDITIONS : CONSULTATION_CONDITIONS.filter(c => c.id === metric);
  return conditions.map(c => ({ id: c.id, label: c.label, color: CONDITION_COLORS[c.id], values: buckets.map(b => b.conditions[c.id] ?? 0) }));
}

export default function TrendSection({ id, locationId, date, token, refresh, onLoaded, delay }: {
  id?: string; locationId: AnalyticsLocation; date: string; token: string; refresh: number; onLoaded?: (trend: AnalyticsTrend | null) => void; delay?: number;
}) {
  const [range, setRange] = useState<TrendRange>("30d");
  const [metric, setMetric] = useState("patients");
  const [data, setData] = useState<AnalyticsTrend | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getAnalyticsTrend(locationId, date, range, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) { setData(null); setError(err instanceof Error ? err.message : "Unable to load trends."); } });
    return () => controller.abort();
  }, [locationId, date, range, token, refresh]);

  // Hold the previous chart (dimmed) while a new range loads instead of flashing empty.
  const current = data?.range === range && data.date === date && data.locationId === locationId;
  useEffect(() => { onLoaded?.(current ? data : null); }, [current, data, onLoaded]);
  const unit = RANGES.find(r => r.id === range)!.unit;
  const caption = metric === "patients" ? `Patients reached and consulted per ${unit}`
    : metric === "conditions" ? `Patients consulted per condition per ${unit}`
    : `Patients consulted with ${CONSULTATION_CONDITIONS.find(c => c.id === metric)?.label.toLowerCase()} per ${unit}`;
  const labels = data?.buckets.map(b => bucketLabels(b, data.range)) ?? [];

  return <SectionCard id={id} icon={TrendingUp} tone="bg-blue-100 text-blue-700" title="Trends over time" label="Trends over time" delay={delay}
    description={`${caption}, ending on the selected date.`}
    info={<>Each point counts unique patients in that {unit}. Someone who visits twice in the same {unit} counts once, so points should not be added together. Hover, tap or use the arrow keys on the chart to read exact values.</>}
    actions={<>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Show
        <select aria-label="Trend metric" value={metric} onChange={event => setMetric(event.target.value)} className={`${fieldClass} text-foreground`}>
          <option value="patients">Patients reached &amp; consulted</option>
          <option value="conditions">Compare all conditions</option>
          <optgroup label="Single condition">{CONSULTATION_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
        </select>
      </label>
      <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Range
        <Segmented label="Trend range" value={range} onChange={setRange} options={RANGES} />
      </div>
    </>}>
    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    {!error && !data && <div role="status" aria-label="Loading trends" className="h-[280px] animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />}
    {!error && data && <div className={current ? "transition-opacity duration-300" : "opacity-50 transition-opacity duration-300"} aria-busy={!current}>
      <LineChart caption={caption} labels={labels.map(l => l.axis)} tooltipLabels={labels.map(l => l.full)} series={seriesFor(metric, data.buckets)} />
    </div>}
  </SectionCard>;
}
