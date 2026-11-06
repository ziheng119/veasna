export default function formatDate(isoDate: string | null): string {
  if (!isoDate) return "N/A";
  return isoDate.split('T')[0];
}
/** "2026-12-13" -> "13 Dec 2026", for screening days. */
export function formatDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate.split("T")[0]}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
