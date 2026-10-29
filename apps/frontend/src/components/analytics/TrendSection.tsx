"use client";

import { useEffect, useState } from "react";
import { AnalyticsLocation, AnalyticsTrend, getAnalyticsTrend, TrendBucket, TrendRange } from "@/lib/api/analytics";
import { CONDITION_COLORS, CONSULTATION_CONDITIONS, PRIMARY_SERIES_COLOR, SECONDARY_SERIES_COLOR } from "@/constants/consultationConditions";
import { ChartSeries, LineChart } from "./charts";

const panel = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";
const RANGES: { id: TrendRange; label: string; unit: string }[] = [
  { id: "7d", label: "Last 7 days", unit: "day" },
  { id: "30d", label: "Last 30 days", unit: "day" },
  { id: "12w", label: "Last 12 weeks", unit: "week" },
  { id: "12m", label: "Last 12 months", unit: "month" },
];

const shortDate = (value: string, options: Intl.DateTimeFormatOptions) => new Date(value + "T00:00:00").toLocaleDateString(undefined, options);
function bucketLabel(bucket: TrendBucket, range: TrendRange) {
  if (range === "12m") return shortDate(bucket.startDate, { month: "short", year: "2-digit" });
  if (range === "12w") return `${shortDate(bucket.startDate, { day: "numeric", month: "short" })}–${shortDate(bucket.endDate, { day: "numeric", month: "short" })}`;
  return shortDate(bucket.startDate, { day: "numeric", month: "short" });
}

function seriesFor(metric: string, buckets: TrendBucket[]): ChartSeries[] {
  if (metric === "patients") return [
    { id: "people", label: "Patients reached", color: PRIMARY_SERIES_COLOR, values: buckets.map(b => b.people) },
    { id: "consulted", label: "Patients consulted", color: SECONDARY_SERIES_COLOR, values: buckets.map(b => b.consultedPeople) },
  ];
  const conditions = metric === "conditions" ? CONSULTATION_CONDITIONS : CONSULTATION_CONDITIONS.filter(c => c.id === metric);
  return conditions.map(c => ({ id: c.id, label: c.label, color: CONDITION_COLORS[c.id], values: buckets.map(b => b.conditions[c.id] ?? 0) }));
}

export default function TrendSection({ locationId, date, token, refresh }: { locationId: AnalyticsLocation; date: string; token: string; refresh: number }) {
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
  const unit = RANGES.find(r => r.id === range)!.unit;
  const caption = metric === "patients" ? `Patients reached and consulted per ${unit}`
    : metric === "conditions" ? `Patients consulted per condition per ${unit}`
    : `Patients consulted with ${CONSULTATION_CONDITIONS.find(c => c.id === metric)?.label.toLowerCase()} per ${unit}`;

  return <section className={panel} aria-label="Trends over time">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-base font-semibold">Trends over time</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{caption}, ending on the selected date. Patients are counted once per {unit}, so values are not added across {unit}s.</p></div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-2 text-sm font-medium">Show
          <select aria-label="Trend metric" value={metric} onChange={event => setMetric(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3">
            <option value="patients">Patients reached &amp; consulted</option>
            <option value="conditions">Compare all conditions</option>
            <optgroup label="Single condition">{CONSULTATION_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">Range
          <select aria-label="Trend range" value={range} onChange={event => setRange(event.target.value as TrendRange)} className="h-10 rounded-lg border border-input bg-background px-3">
            {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
      </div>
    </div>
    <div className="mt-5">
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
      {!error && !data && <p role="status" className="py-10 text-center text-sm text-muted-foreground">Loading trends...</p>}
      {!error && data && <div className={current ? "" : "opacity-50 transition-opacity"}>
        <LineChart caption={caption} labels={data.buckets.map(b => bucketLabel(b, data.range))} series={seriesFor(metric, data.buckets)} />
      </div>}
    </div>
  </section>;
}
