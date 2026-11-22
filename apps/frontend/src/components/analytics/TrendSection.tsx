"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { AnalyticsPeriod, AnalyticsTrend, getAnalyticsTrend, TrendBucket } from "@/lib/api/analytics";
import { PRIMARY_SERIES_COLOR, SECONDARY_SERIES_COLOR, conditionColor, conditionDash } from "@/constants/consultationConditions";
import { useFormOptions } from "@/stores/useFormOptionsStore";
import type { FormOption } from "@/lib/types/formOptions";
import { Button } from "@/components/ui/button";
import { ChartSeries, LineChart } from "./charts";
import { fieldClass, SectionCard } from "./ui";
import { shortDate, readableDate } from "./dates";

type Unit = NonNullable<AnalyticsTrend["unit"]>;

// What the chart covers for each period: a day or week shows the week for context.
const WINDOW: Record<AnalyticsPeriod, string> = {
  day: "the 7 days up to the selected date",
  week: "the 7 days up to the selected date",
  month: "the 30 days up to the selected date",
  trip: "the trip's dates (at least 7 days)",
  all: "the 12 months up to the selected date",
};

// Axis labels stay short; tooltips and the table show the full bucket range.
function bucketLabels(bucket: TrendBucket, unit: Unit) {
  if (unit === "month") return { axis: shortDate(bucket.startDate, { month: "short" }), full: shortDate(bucket.startDate, { month: "long", year: "numeric" }) };
  if (unit === "week") return { axis: shortDate(bucket.startDate), full: `${shortDate(bucket.startDate)} – ${readableDate(bucket.endDate)}` };
  return { axis: shortDate(bucket.startDate), full: shortDate(bucket.startDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) };
}

function seriesFor(metric: string, buckets: TrendBucket[], listed: FormOption[]): ChartSeries[] {
  if (metric === "patients") return [
    { id: "people", label: "Patients reached", color: PRIMARY_SERIES_COLOR, values: buckets.map(b => b.people) },
    { id: "consulted", label: "Patients consulted", color: SECONDARY_SERIES_COLOR, dash: "6 3", values: buckets.map(b => b.consultedPeople) },
  ];
  const conditions = metric === "conditions" ? listed : listed.filter(c => c.id === metric);
  return conditions.map(c => ({ id: c.id, label: c.label, color: conditionColor(c.id, listed), dash: conditionDash(c.id, listed), values: buckets.map(b => b.conditions[c.id] ?? 0) }));
}

/** Trends over time for the page's period and date (the chart's window follows them; see WINDOW). */
export default function TrendSection({ id, date, period, token, refresh, onLoaded, delay }: {
  id?: string; date: string; period: AnalyticsPeriod; token: string; refresh: number; onLoaded?: (trend: AnalyticsTrend | null) => void; delay?: number;
}) {
  const conditions = useFormOptions("consultation_conditions");
  const [metric, setMetric] = useState("patients");
  const [data, setData] = useState<AnalyticsTrend | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getAnalyticsTrend(date, period, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load trends."); });
    return () => controller.abort();
  }, [date, period, token, refresh, retry]);

  // Hold the previous chart (dimmed) while new filters load instead of flashing empty.
  const current = data?.period === period && data.date === date;
  useEffect(() => { onLoaded?.(current ? data : null); }, [current, data, onLoaded]);
  const unit: Unit = data?.unit ?? "day";
  const caption = metric === "patients" ? `Patients reached and consulted per ${unit}`
    : metric === "conditions" ? `Patients consulted per condition per ${unit}`
    : `Patients consulted with ${conditions.find(c => c.id === metric)?.label.toLowerCase()} per ${unit}`;
  const labels = data?.buckets.map(b => bucketLabels(b, unit)) ?? [];

  return <SectionCard id={id} icon={TrendingUp} title="Trends over time" label="Trends over time" delay={delay}
    description={`${caption}, over ${WINDOW[period]}.`}
    info={<>Each point counts unique patients in that {unit}. Someone who visits twice in the same {unit} counts once, so points should not be added together. Hover, tap or use the arrow keys on the chart to read exact values.</>}
    actions={<>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">Show
        <select aria-label="Trend metric" value={metric} onChange={event => setMetric(event.target.value)} className={`${fieldClass} text-foreground`}>
          <option value="patients">Patients reached &amp; consulted</option>
          <option value="conditions">Compare all conditions</option>
          <optgroup label="Single condition">{conditions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
        </select>
      </label>
    </>}>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
      <span>{error}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>Try again</Button>
    </div>}
    {!error && !data && <div role="status" aria-label="Loading trends" className="h-[280px] animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}
    {!error && data && <div className={current ? "transition-opacity duration-300" : "opacity-50 transition-opacity duration-300"} aria-busy={!current}>
      <LineChart caption={caption} labels={labels.map(l => l.axis)} tooltipLabels={labels.map(l => l.full)} series={seriesFor(metric, data.buckets, conditions)} />
    </div>}
  </SectionCard>;
}
