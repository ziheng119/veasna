/* eslint-disable @next/next/no-head-element, @next/next/no-img-element -- Standalone print document, not a Next route. */
import { renderToStaticMarkup } from "react-dom/server";
import { LETTERHEAD } from "@/constants/letterhead";
import { STATIONS } from "@/constants/stations";
import type { Analytics } from "@/lib/api/analytics";
import { readableDate } from "./dates";

export interface AnalyticsReportOptions {
  // e.g. "This trip", "Single day".
  periodName: string;
  // e.g. "13 – 18 Nov 2026".
  dateRange: string;
  // The one-sentence summary shown at the top of the page.
  headline: string;
  // "Waiting" on today's Day view, otherwise "Not discharged".
  openLabel: string;
  conditions: readonly { id: string; label: string }[];
  logoUrl?: string;
}

const AGE_GROUPS = ["Under 18", "18–59", "60+", "Unknown"];
const percent = (count: number, total: number) => (total ? `${Math.round(count / total * 100)}%` : "–");

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return <table>
    <thead><tr>{head.map((cell, i) => <th key={cell} className={i ? "num" : undefined}>{cell}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={String(row[0])}>{row.map((cell, i) => <td key={i} className={i ? "num" : undefined}>{cell}</td>)}</tr>)}</tbody>
  </table>;
}

/**
 * The Analytics numbers as a printable report (A4 portrait): headline, totals, clinic days with
 * their village accounts, conditions, ages, referral destinations and station workload. No patient
 * names. React escapes every saved value.
 */
export function analyticsReportDocumentHtml(data: Analytics, options: AnalyticsReportOptions): string {
  const s = data.summary;
  const days = data.days ?? [];
  const conditionCount = (id: string) => data.conditions.find(item => item.id === id)?.count ?? 0;
  return "<!doctype html>" + renderToStaticMarkup(<html lang="en"><head>
    <meta charSet="utf-8" /><title>{`${LETTERHEAD.organisation} — Clinic report`}</title>
    <style>{`
      @page { size: A4 portrait; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #222; font: 10pt Georgia, serif; }
      .letterhead { display: flex; align-items: center; gap: 5mm; padding-bottom: 4mm; border-bottom: 2px solid #333; }
      .logo { height: 16mm; width: auto; object-fit: contain; }
      .organisation { flex: 1; }
      .organisation div, .meta { font-size: 9pt; color: #444; }
      .meta { text-align: right; line-height: 1.6; }
      h1 { font-size: 16pt; margin: 0 0 1mm; }
      h2 { font-size: 12pt; margin: 7mm 0 2mm; }
      .headline { font-size: 12pt; line-height: 1.5; margin: 6mm 0 0; }
      .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 5mm; }
      .total { border: 1px solid #bbb; padding: 3mm; }
      .total b { display: block; font-size: 18pt; font-variant-numeric: tabular-nums; }
      .total span { font-size: 9pt; color: #555; }
      .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #ccc; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
      th { font-size: 9pt; color: #444; border-bottom: 1px solid #888; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .note { font-size: 8.5pt; color: #555; margin: 1.5mm 0 0; }
      section { break-inside: avoid; }
    `}</style>
  </head><body>
    <header className="letterhead">
      {options.logoUrl && <img className="logo" src={options.logoUrl} alt={`${LETTERHEAD.organisation} logo`} />}
      <div className="organisation"><h1>{LETTERHEAD.organisation}</h1><div>{LETTERHEAD.subtitle} · Clinic report</div></div>
      <div className="meta"><div>{options.periodName}</div><div>{options.dateRange}</div><div>Printed {readableDate(data.generatedAt.slice(0, 10))}</div></div>
    </header>
    <p className="headline">{options.headline}</p>
    <div className="totals">
      {[["Patients reached", s.people, `${s.visits} visits`], ["Patients consulted", s.consultedPeople, percent(s.consultedPeople, s.people) + " of reached"],
        ["Visits with referrals", s.referralVisits, `${s.unsignedReferrals} unsigned`], ["Visits discharged", s.dischargedVisits, `${s.visits - s.dischargedVisits} ${options.openLabel.toLowerCase()}`]]
        .map(([label, value, detail]) => <div key={label} className="total"><span>{label}</span><b>{value}</b><span>{detail}</span></div>)}
    </div>
    {days.length > 1 && <section><h2>By clinic day</h2>
      <Table head={["Date", "Village account", "Patients", "Consulted", "Referrals"]}
        rows={days.map(day => [readableDate(day.date), day.accounts.join(", ") || "–", day.people, day.consultedPeople, day.referralVisits])} />
      <p className="note">Patients are counted once per day; someone seen on two days appears on both.</p>
    </section>}
    <div className="columns">
      <section><h2>Conditions seen in consultation</h2>
        <Table head={["Condition", "Patients"]} rows={options.conditions.map(c => [c.label, conditionCount(c.id)])} />
        <p className="note">{s.conditionReviewedVisits} of {s.consultedVisits} consultations recorded conditions (including None).</p>
      </section>
      <section><h2>Who we reached</h2>
        <Table head={["Age group", "Patients", "Share"]} rows={AGE_GROUPS.map(label => {
          const count = data.ages.find(item => item.label === label)?.count ?? 0;
          return [label, count, percent(count, s.people)];
        })} />
      </section>
      <section><h2>Referral destinations</h2>
        {data.destinations.length
          ? <Table head={["Destination", "Visits"]} rows={data.destinations.map(d => [d.label, d.count])} />
          : <p className="note">No referrals saved.</p>}
        <p className="note">A referral can name several destinations, so these can add up to more than the visits with referrals.</p>
      </section>
      <section><h2>Station workload</h2>
        <Table head={["Station", "Assigned", "Completed", options.openLabel]} rows={STATIONS.map(station => {
          const row = data.stations.find(item => item.station === station.id);
          return [station.label, row?.assigned ?? 0, row?.completed ?? 0, row?.waiting ?? 0];
        })} />
      </section>
    </div>
  </body></html>);
}
