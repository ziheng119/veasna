"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Glasses } from "lucide-react";
import { AnalyticsOptician, AnalyticsPeriod, getAnalyticsOptician, OpticianReferral } from "@/lib/api/analytics";
import { cn } from "@/lib/utils";
import FamilyBadge from "@/components/shared/FamilyBadge";
import TbBadge from "@/components/shared/TbBadge";
import StickerTag, { findSticker, useStickerColours } from "@/components/shared/StickerTag";
import { readableDate } from "./dates";
import { SectionCard } from "./ui";

interface Props {
  id?: string;
  date: string;
  period: AnalyticsPeriod;
  token: string;
  // Bumped by the page's Refresh button.
  refresh: number;
  delay?: number;
}

const HEAD = "px-3 py-2 font-medium";
// The eye readings taken, e.g. "L 20/200 · R 20/40"; null when neither eye was read.
const eyes = (left: string | null, right: string | null) =>
  left || right ? `L ${left || "–"} · R ${right || "–"}` : null;
const READINGS: [string, (row: OpticianReferral) => string | null][] = [
  ["Without pinhole", row => eyes(row.leftWithoutPinhole, row.rightWithoutPinhole)],
  ["With pinhole", row => eyes(row.leftWithPinhole, row.rightWithPinhole)],
  ["With glasses", row => eyes(row.leftWithGlasses, row.rightWithGlasses)],
];

/**
 * Analytics: patients Triage ticked "Refer to optician" for in the period, newest visit first, with
 * their details and visual acuity readings to take to the optician.
 */
export default function OpticianSection({ id, date, period, token, refresh, delay }: Props) {
  const [data, setData] = useState<AnalyticsOptician | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const stickers = useStickerColours();

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getAnalyticsOptician(date, period, token, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) { setData(null); setError(err instanceof Error ? err.message : "Unable to load the optician referrals."); } });
    return () => controller.abort();
  }, [date, period, token, refresh, retry]);

  // Keep showing the previous list (dimmed) while new filters load.
  const current = data?.date === date && data.period === period;
  const count = data?.patients.length ?? 0;

  return <SectionCard id={id} icon={Glasses} title="Optician referrals" delay={delay}
    description={count > 0 ? `${count} ${count === 1 ? "patient" : "patients"}${data?.more ? " or more" : ""} to refer to an optician in this period.` : "Patients ticked “Refer to optician” at Triage."}
    info="From “Refer to optician” under the visual acuity at Triage, by visit date. The readings are the Snellen test taken at Triage (L left eye, R right eye).">
    <div aria-live="polite">
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        <span>{error}</span>
        <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-full border border-destructive/30 px-3 py-1 font-medium transition hover:bg-destructive/10 active:scale-95">Try again</button>
      </div>}
      {!data && !error && <div role="status" aria-label="Loading optician referrals" className="h-32 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}
    </div>
    {data && <div className={cn("transition-opacity duration-200", !current && "opacity-60")} aria-busy={!current}>
      {count === 0
        ? <p className="grid min-h-24 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">No optician referrals for this period.</p>
        : <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className={HEAD}>Seen</th>
                <th className={HEAD}>Patient</th>
                <th className={HEAD}>Sex</th>
                <th className={HEAD}>Date of birth</th>
                <th className={HEAD}>Phone</th>
                <th className={HEAD}>Address</th>
                <th className={HEAD}>Visual acuity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.patients.map(row => {
                const readings = READINGS.map(([label, read]) => [label, read(row)] as const).filter(([, value]) => value);
                return <tr key={row.visitId} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="block">{readableDate(row.visitDate)}</span>
                    <span className="block text-xs text-muted-foreground">Queue {row.queueNo}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <Link href={`/patient-details?id=${row.patientId}`}
                        className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {row.englishName || "Unnamed patient"}
                      </Link>
                      {row.tbStatus === "flagged" && <TbBadge />}
                      {row.family && <FamilyBadge family={row.family} />}
                      {row.stickerColour && <StickerTag sticker={findSticker(stickers, row.stickerColour)} />}
                    </span>
                    {row.khmerName && <span className="block text-muted-foreground">{row.khmerName}</span>}
                  </td>
                  <td className="px-3 py-2">{row.sex || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.dateOfBirth ? readableDate(row.dateOfBirth) : "-"}</td>
                  <td className="px-3 py-2">{row.phone || "-"}</td>
                  <td className="px-3 py-2">{row.address || "-"}</td>
                  <td className="px-3 py-2">
                    {readings.length === 0 ? <span className="text-muted-foreground">Not taken</span>
                      : <dl className="space-y-0.5 text-xs">{readings.map(([label, value]) => <div key={label} className="flex gap-2 whitespace-nowrap">
                          <dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{value}</dd></div>)}</dl>}
                    {row.notes && <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
      {data.more && <p className="mt-3 text-xs text-muted-foreground">Showing the newest 500 patients. Choose a shorter period to see the rest.</p>}
    </div>}
  </SectionCard>;
}
