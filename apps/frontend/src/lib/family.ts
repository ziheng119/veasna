// Families: patients who came together share a letter on their visits (A, B, ... AA), apart from
// their queue numbers. They are shown side by side, and members waiting at the same station move on
// together (apps/backend/utils/familyMoves.js).

import { StationId, stationLabel } from "@/constants/stations";

// Colours told apart at a glance; a family keeps its colour everywhere it is shown. Full class names,
// so Tailwind keeps them.
const TONES = [
  { badge: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200", stripe: "bg-sky-500" },
  { badge: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200", stripe: "bg-amber-500" },
  { badge: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200", stripe: "bg-violet-500" },
  { badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200", stripe: "bg-emerald-500" },
  { badge: "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200", stripe: "bg-pink-500" },
  { badge: "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200", stripe: "bg-teal-500" },
];

export function familyTone(family: string) {
  const index = family.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  return TONES[((index % TONES.length) + TONES.length) % TONES.length];
}

// Moves each family's members up to just after the first of them in the list; everything else keeps
// its order.
export function groupFamilies<T>(items: T[], familyOf: (item: T) => string | null | undefined): T[] {
  const members = new Map<string, T[]>();
  for (const item of items) {
    const family = familyOf(item);
    if (family) members.set(family, [...(members.get(family) ?? []), item]);
  }
  const placed = new Set<string>();
  return items.flatMap((item) => {
    const family = familyOf(item);
    if (!family) return [item];
    if (placed.has(family)) return [];
    placed.add(family);
    return members.get(family)!;
  });
}

// Result of finishing a station (POST /api/queue/:visitId/stations/:station/complete).
export interface StationMove {
  next_station: StationId | null;
  // Done here, but waiting for these family members at the same station.
  held: boolean;
  waiting_for: { visit_id: number; queue_no: string; english_name?: string | null }[];
  // Family members who moved on together with this patient.
  family_moved: { visit_id: number; queue_no: string; next_station: StationId | null }[];
}

export function stationMoveMessage(name: string, move: StationMove): string {
  if (move.held) {
    const others = move.waiting_for.map((member) => `${member.queue_no}${member.english_name ? ` ${member.english_name}` : ""}`);
    return `${name} is done here and waits for their family (${others.join(", ")}). They move on together.`;
  }
  const where = move.next_station ? `sent to ${stationLabel(move.next_station)}` : "has finished all stations";
  const family = move.family_moved.length
    ? `, with family ${move.family_moved.map((member) => member.queue_no).join(", ")}`
    : "";
  return `${name} ${where}${family}.`;
}
