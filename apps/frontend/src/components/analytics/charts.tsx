"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Dependency-free SVG charts so analytics renders on an offline host without a
// chart library. Colors are passed in per entity; text always uses theme ink.

export interface ChartSeries { id: string; label: string; color: string; values: number[] }

const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";

// Round the axis maximum up to 1/2/5 × 10ⁿ steps so ticks are whole, readable numbers.
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map(m => m * magnitude).find(s => s >= raw) ?? raw);
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

// Tracks the rendered width so charts redraw at real pixel size (text never shrinks
// on phones or stretches on wide screens). Falls back to a fixed width when unmeasured.
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width || fallback] as const;
}

export function Legend({ items }: { items: { id: string; label: string; color: string }[] }) {
  return <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
    {items.map(item => <li key={item.id} className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden="true" />
      <span className="text-foreground">{item.label}</span>
    </li>)}
  </ul>;
}

function TableView({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return <details className="group mt-4 text-sm">
    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      <span className="inline-block transition-transform duration-200 group-open:rotate-90" aria-hidden="true">›</span> Show as table
    </summary>
    <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border animate-in fade-in duration-200 motion-reduce:animate-none">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-muted text-muted-foreground"><tr>{columns.map((column, i) => <th key={column} className={cn("px-3 py-2 font-medium", i && "text-right")}>{column}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={String(row[0])} className="border-t border-border transition-colors hover:bg-muted/50">{row.map((cell, i) => <td key={i} className={cn("px-3 py-2", i && "text-right tabular-nums")}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}

export function LineChart({ labels, tooltipLabels = labels, series, caption }: { labels: string[]; tooltipLabels?: string[]; series: ChartSeries[]; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth(720);
  const compact = width < 480;
  const height = compact ? 220 : 280, left = 36, right = 12, top = 12, bottom = 30;
  const plotW = Math.max(1, width - left - right), plotH = height - top - bottom;
  const ticks = niceTicks(Math.max(0, ...series.flatMap(s => s.values)));
  const yMax = ticks[ticks.length - 1];
  const x = (i: number) => left + (labels.length > 1 ? i / (labels.length - 1) * plotW : plotW / 2);
  const y = (value: number) => top + plotH - value / yMax * plotH;
  // Label density follows the available width: roughly one label per 72px.
  const labelEvery = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(plotW / 72))));
  const showLabel = (i: number) => i === labels.length - 1 || (i % labelEvery === 0 && labels.length - 1 - i >= labelEvery / 2);
  const showMarkers = labels.length <= 14;
  const slot = labels.length > 1 ? plotW / (labels.length - 1) : plotW;
  const drawKey = series.map(s => s.id + s.values.join(",")).join("|");

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setHover(current => Math.min(labels.length - 1, Math.max(0, (current ?? (event.key === "ArrowLeft" ? labels.length : -1)) + (event.key === "ArrowLeft" ? -1 : 1))));
  };
  const tooltipLeft = hover === null ? 0 : x(hover);

  return <div>
    {series.length > 1 && <div className="mb-3"><Legend items={series} /></div>}
    <div ref={ref} className="relative">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${caption}. Use left and right arrow keys to read values.`}
        tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)} onMouseLeave={() => setHover(null)}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {ticks.map(tick => <g key={tick}>
          <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={tick ? GRID : AXIS} strokeWidth={1} />
          <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">{tick}</text>
        </g>)}
        {labels.map((label, i) => showLabel(i) &&
          <text key={i} x={x(i)} y={height - 8} textAnchor={i === labels.length - 1 && labels.length > 1 ? "end" : i === 0 ? "start" : "middle"} fontSize={11} fill={MUTED}>{label}</text>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotH} stroke={AXIS} strokeWidth={1} />}
        <g key={drawKey}>{series.map((s, index) => <g key={s.id}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} pathLength={1} className="chart-draw" style={{ animationDelay: `${index * 60}ms` }}
            fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={hover !== null ? 0.9 : 1} />
          {s.values.map((v, i) => (showMarkers || hover === i) &&
            <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke="#ffffff" strokeWidth={2}
              className="animate-in fade-in zoom-in-50 fill-mode-both duration-300 motion-reduce:animate-none" style={{ animationDelay: `${300 + i * 25}ms`, transformBox: "fill-box", transformOrigin: "center" }} />)}
        </g>)}</g>
        {labels.map((_, i) => <rect key={i} x={x(i) - slot / 2} y={top} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />)}
      </svg>
      {hover !== null && <div role="tooltip" className="pointer-events-none absolute top-2 z-10 min-w-40 max-w-[70%] rounded-lg border border-border bg-card p-3 text-xs shadow-md animate-in fade-in zoom-in-95 duration-100 motion-reduce:animate-none"
        style={tooltipLeft > width / 2 ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}>
        <p className="mb-2 font-medium">{tooltipLabels[hover]}</p>
        {[...series].sort((a, b) => b.values[hover] - a.values[hover]).map(s => <p key={s.id} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />{s.label}</span>
          <span className="tabular-nums">{s.values[hover]}</span>
        </p>)}
      </div>}
    </div>
    <TableView caption={caption} columns={["Period", ...series.map(s => s.label)]} rows={tooltipLabels.map((label, i) => [label, ...series.map(s => s.values[i])])} />
  </div>;
}

interface DonutItem { id: string; label: string; color: string; count: number }

// Clicking a segment or legend row selects it (onSelect); hovering previews it.
export function DonutChart({ items, caption, centerLabel, selected, onSelect }: {
  items: DonutItem[]; caption: string; centerLabel: string; selected?: string; onSelect?: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const radius = 80, stroke = 28, size = 2 * (radius + stroke) + 8;
  const circumference = 2 * Math.PI * radius;
  const visible = items.filter(item => item.count > 0);
  // A 2px surface gap separates segments; a single segment needs none.
  const gap = visible.length > 1 ? 2 : 0;
  let offset = 0;
  const percent = (count: number) => total ? `${Math.round(count / total * 100)}%` : "0%";
  const focus = hover ?? selected ?? null;
  const active = items.find(item => item.id === focus && item.count > 0);

  return <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
    <svg viewBox={`0 0 ${size} ${size}`} className="w-44 shrink-0 animate-in fade-in zoom-in-90 duration-500 motion-reduce:animate-none sm:w-48" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={GRID} strokeWidth={stroke} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {visible.map(item => {
          const length = item.count / total * circumference;
          const emphasised = focus === item.id;
          const segment = <circle key={item.id} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={item.color}
            strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`} strokeDashoffset={-offset}
            style={{ strokeWidth: emphasised ? stroke + 8 : stroke, opacity: focus && !emphasised ? 0.35 : 1, transition: "stroke-width 200ms ease, opacity 200ms ease" }}
            className={onSelect ? "cursor-pointer" : undefined} onMouseEnter={() => setHover(item.id)} onClick={() => onSelect?.(item.id)}>
            <title>{`${item.label}: ${item.count} (${percent(item.count)})`}</title>
          </circle>;
          offset += length;
          return segment;
        })}
      </g>
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize={30} fontWeight={600} fill="currentColor">{active ? active.count : total}</text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fontSize={11} fill={MUTED}>{active ? percent(active.count) + " of selections" : centerLabel}</text>
    </svg>
    <ul className="w-full space-y-1 text-sm">
      {items.map(item => {
        const isSelected = selected === item.id;
        const row = <>
          <span className="flex min-w-0 items-center gap-2"><span className={cn("size-2.5 shrink-0 rounded-full transition-transform duration-200", focus === item.id && "scale-125")} style={{ background: item.color }} aria-hidden="true" />
            <span className="truncate">{item.label}</span></span>
          <span className="shrink-0 tabular-nums text-muted-foreground"><span className="font-medium text-foreground">{item.count}</span> · {percent(item.count)}</span>
        </>;
        const rowClass = cn("flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-150",
          isSelected ? "bg-muted ring-1 ring-border" : focus === item.id ? "bg-muted/60" : "", onSelect && "hover:bg-muted active:scale-[0.99]");
        return <li key={item.id} onMouseEnter={() => setHover(item.id)} onMouseLeave={() => setHover(null)}>
          {onSelect
            ? <button type="button" aria-pressed={isSelected} onClick={() => onSelect(item.id)} className={cn(rowClass, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>{row}</button>
            : <div className={rowClass}>{row}</div>}
        </li>;
      })}
    </ul>
  </div>;
}

export function BarList({ items, color, unit }: { items: { id: string; label: string; value: number; detail?: string }[]; color: string; unit: string }) {
  const max = Math.max(1, ...items.map(item => item.value));
  return <ul className="space-y-4">{items.map((item, index) => <li key={item.id} title={`${item.label}: ${item.value} ${unit}`} className="group">
    <div className="mb-1.5 flex justify-between gap-4 text-sm"><span className="truncate">{item.label}</span>
      <span className="shrink-0 tabular-nums">{item.value}{item.detail && <span className="text-muted-foreground"> · {item.detail}</span>}</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="bar-grow h-full rounded-full transition-[width,filter] duration-500 group-hover:brightness-110" style={{ width: `${item.value / max * 100}%`, background: color, animationDelay: `${index * 60}ms` }} />
    </div>
  </li>)}</ul>;
}
