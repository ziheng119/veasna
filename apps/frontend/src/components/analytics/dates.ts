import type { AnalyticsPeriod } from "@/lib/api/analytics";

// One date format across Analytics and its printouts: en-GB, e.g. "18 Nov 2026".
const at = (date: string) => new Date(`${date}T00:00:00`);

/** "18 Nov" by default; pass options for other parts (always en-GB order). */
export const shortDate = (date: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  at(date).toLocaleDateString("en-GB", options);

/** "18 Nov 2026". */
export const readableDate = (date: string) => shortDate(date, { day: "numeric", month: "short", year: "numeric" });

/**
 * The dates a period covers, as words: "18 Nov 2026", "12 – 18 Nov 2026", "all dates up to 18 Nov 2026".
 * startDate is the first date (from the host for a trip); null for all dates.
 */
export function periodRangeText(period: AnalyticsPeriod, startDate: string | null, date: string): string {
  if (!date) return "";
  if (period === "all" || !startDate) return `all dates up to ${readableDate(date)}`;
  if (startDate === date) return readableDate(date);
  const sameYear = startDate.slice(0, 4) === date.slice(0, 4);
  const sameMonth = sameYear && startDate.slice(0, 7) === date.slice(0, 7);
  const from = sameMonth ? shortDate(startDate, { day: "numeric" }) : sameYear ? shortDate(startDate) : readableDate(startDate);
  return `${from} – ${readableDate(date)}`;
}

/** Days from one YYYY-MM-DD date to another, counting both (12 – 18 Nov is 7). */
export const daysCovered = (startDate: string, date: string) => Math.round((at(date).getTime() - at(startDate).getTime()) / 86400000) + 1;
