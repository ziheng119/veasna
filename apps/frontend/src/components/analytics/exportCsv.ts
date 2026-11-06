import { Analytics, AnalyticsTrend } from "@/lib/api/analytics";
import { STATIONS } from "@/constants/stations";
import { CONSULTATION_CONDITIONS } from "@/constants/consultationConditions";

export type Cell = string | number | boolean | null | undefined;

// Long format (one value per row) so the file filters and pivots cleanly in a spreadsheet.
// `conditions`: the Consult form's current list, for the trend columns.
export function buildAnalyticsCsv(data: Analytics, trend: AnalyticsTrend | null, scope: { location: string; period: string },
  conditions: readonly { id: string; label: string }[] = CONSULTATION_CONDITIONS) {
  const rows: Cell[][] = [["Section", "Item", "Measure", "Value"]];
  const add = (section: string, item: string, measure: string, value: Cell) => rows.push([section, item, measure, value]);

  add("Filters", "Location", "", scope.location);
  add("Filters", "Period", "", scope.period);
  add("Filters", "Start date", "", data.startDate ?? "All recorded dates");
  add("Filters", "End date", "", data.endDate ?? data.date);
  add("Filters", "Generated at", "", data.generatedAt);

  const s = data.summary;
  add("Summary", "Patients reached", "Unique patients", s.people);
  add("Summary", "Registered visits", "Visits", s.visits);
  add("Summary", "Patients consulted", "Unique patients", s.consultedPeople);
  add("Summary", "Visits with referrals", "Visits", s.referralVisits);
  add("Summary", "Visits discharged", "Visits", s.dischargedVisits);
  add("Summary", "Consultations with conditions recorded", "Visits", s.conditionReviewedVisits);
  add("Summary", "Completed consultations", "Visits", s.consultedVisits);

  data.conditions.forEach(c => add("Conditions", c.label, "Unique patients", c.count));
  data.ages.forEach(a => add("Age groups", a.label, "Unique patients", a.count));
  STATIONS.forEach(station => {
    const row = data.stations.find(item => item.station === station.id);
    add("Station workload", station.label, "Assigned", row?.assigned ?? 0);
    add("Station workload", station.label, "Completed", row?.completed ?? 0);
    add("Station workload", station.label, "Waiting", row?.waiting ?? 0);
  });
  data.destinations.forEach(d => add("Referral destinations", d.label, "Visits", d.count));
  add("Documentation", "Non-empty consultation notes", "Visits", s.notesSaved);
  add("Documentation", "Unsigned saved referrals", "Visits", s.unsignedReferrals);

  trend?.buckets.forEach(bucket => {
    const item = bucket.startDate === bucket.endDate ? bucket.startDate : `${bucket.startDate} to ${bucket.endDate}`;
    add("Trend", item, "Patients reached", bucket.people);
    add("Trend", item, "Patients consulted", bucket.consultedPeople);
    conditions.forEach(c => add("Trend", item, c.label, bucket.conditions[c.id] ?? 0));
  });

  return toCsv(rows);
}

/** CSV text for a table. The byte-order mark makes Excel read UTF-8 text such as "18–59" or Khmer names correctly. */
export function toCsv(rows: Cell[][]): string {
  const escape = (cell: Cell) => {
    const text = String(cell ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + rows.map(row => row.map(escape).join(",")).join("\r\n");
}

export function downloadFile(contents: string, filename: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
