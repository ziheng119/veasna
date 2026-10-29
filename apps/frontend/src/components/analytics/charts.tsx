"use client";

import { useState } from "react";

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

function Legend({ items }: { items: { id: string; label: string; color: string; detail?: string }[] }) {
  return <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
    {items.map(item => <li key={item.id} className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden="true" />
      <span className="text-foreground">{item.label}</span>{item.detail && <span className="tabular-nums">{item.detail}</span>}
    </li>)}
  </ul>;
}

function TableView({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return <details className="mt-4 text-sm">
    <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Show as table</summary>
    <div className="mt-3 max-h-72 overflow-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-card text-muted-foreground"><tr>{columns.map((column, i) => <th key={column} className={`pb-2 font-medium ${i ? "text-right" : ""}`}>{column}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={String(row[0])} className="border-t border-border">{row.map((cell, i) => <td key={i} className={`py-2 ${i ? "text-right tabular-nums" : ""}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}

export function LineChart({ labels, series, caption }: { labels: string[]; series: ChartSeries[]; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720, height = 260, left = 40, right = 16, top = 12, bottom = 32;
  const plotW = width - left - right, plotH = height - top - bottom;
  const ticks = niceTicks(Math.max(0, ...series.flatMap(s => s.values)));
  const yMax = ticks[ticks.length - 1];
  const x = (i: number) => left + (labels.length > 1 ? i / (labels.length - 1) * plotW : plotW / 2);
  const y = (value: number) => top + plotH - value / yMax * plotH;
  const labelEvery = Math.ceil(labels.length / 7);
  const showMarkers = labels.length <= 14;
  const slot = labels.length > 1 ? plotW / (labels.length - 1) : plotW;

  return <div>
    {series.length > 1 && <div className="mb-3"><Legend items={series} /></div>}
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
        {ticks.map(tick => <g key={tick}>
          <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={tick ? GRID : AXIS} strokeWidth={1} />
          <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">{tick}</text>
        </g>)}
        {labels.map((label, i) => (i % labelEvery === 0 || i === labels.length - 1) && (labels.length - 1 - i >= labelEvery / 2 || i === labels.length - 1) &&
          <text key={i} x={x(i)} y={height - 10} textAnchor="middle" fontSize={11} fill={MUTED}>{label}</text>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotH} stroke={AXIS} strokeWidth={1} />}
        {series.map(s => <g key={s.id}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {s.values.map((v, i) => (showMarkers || hover === i) &&
            <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke="#ffffff" strokeWidth={2} />)}
        </g>)}
        {labels.map((_, i) => <rect key={i} x={x(i) - slot / 2} y={top} width={slot} height={plotH} fill="transparent"
          onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />)}
      </svg>
      {hover !== null && <div role="tooltip" className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-border bg-card p-3 text-xs shadow-md"
        style={x(hover) > width / 2 ? { right: `${(1 - x(hover) / width) * 100 + 2}%` } : { left: `${x(hover) / width * 100 + 2}%` }}>
        <p className="mb-2 font-medium">{labels[hover]}</p>
        {[...series].sort((a, b) => b.values[hover] - a.values[hover]).map(s => <p key={s.id} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />{s.label}</span>
          <span className="tabular-nums">{s.values[hover]}</span>
        </p>)}
      </div>}
    </div>
    <TableView caption={caption} columns={["Period", ...series.map(s => s.label)]} rows={labels.map((label, i) => [label, ...series.map(s => s.values[i])])} />
  </div>;
}

export function DonutChart({ items, caption, centerLabel }: { items: { id: string; label: string; color: string; count: number }[]; caption: string; centerLabel: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const radius = 80, stroke = 28, size = 2 * (radius + stroke);
  const circumference = 2 * Math.PI * radius;
  const visible = items.filter(item => item.count > 0);
  // A 2px surface gap separates segments; a single segment needs none.
  const gap = visible.length > 1 ? 2 : 0;
  let offset = 0;
  const percent = (count: number) => total ? `${Math.round(count / total * 100)}%` : "0%";
  const active = items.find(item => item.id === hover);

  return <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
    <svg viewBox={`0 0 ${size} ${size}`} className="w-48 shrink-0" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={GRID} strokeWidth={stroke} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {visible.map(item => {
          const length = item.count / total * circumference;
          const segment = <circle key={item.id} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={item.color}
            strokeWidth={hover === item.id ? stroke + 6 : stroke} strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`} strokeDashoffset={-offset}
            opacity={hover && hover !== item.id ? 0.45 : 1} onMouseEnter={() => setHover(item.id)}>
            <title>{`${item.label}: ${item.count} (${percent(item.count)})`}</title>
          </circle>;
          offset += length;
          return segment;
        })}
      </g>
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fontSize={28} fontWeight={600} fill="currentColor">{active ? active.count : total}</text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize={11} fill={MUTED}>{active ? active.label : centerLabel}</text>
    </svg>
    <ul className="w-full space-y-2 text-sm">
      {items.map(item => <li key={item.id} onMouseEnter={() => setHover(item.id)} onMouseLeave={() => setHover(null)}
        className={`flex items-center justify-between gap-4 rounded-md px-2 py-1 ${hover === item.id ? "bg-muted" : ""}`}>
        <span className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden="true" />{item.label}</span>
        <span className="tabular-nums text-muted-foreground"><span className="text-foreground">{item.count}</span> · {percent(item.count)}</span>
      </li>)}
    </ul>
  </div>;
}

export function BarList({ items, color, unit }: { items: { id: string; label: string; value: number; detail?: string }[]; color: string; unit: string }) {
  const max = Math.max(1, ...items.map(item => item.value));
  return <ul className="space-y-4">{items.map(item => <li key={item.id} title={`${item.label}: ${item.value} ${unit}`}>
    <div className="mb-1.5 flex justify-between gap-4 text-sm"><span>{item.label}</span>
      <span className="tabular-nums">{item.value}{item.detail && <span className="text-muted-foreground"> · {item.detail}</span>}</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${item.value / max * 100}%`, background: color }} /></div>
  </li>)}</ul>;
}
