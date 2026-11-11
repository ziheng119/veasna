// Layout maths for the guided tour (components/guide/GuideTour.tsx): the spotlight's hole, and
// where the pop-up and its arrow go. Pure functions of rectangles in viewport pixels.

export interface Rect { x: number; y: number; w: number; h: number }
export type Side = "top" | "bottom" | "left" | "right" | "center";
export interface Placement { x: number; y: number; side: Side; arrow: number }

// Keeps the pop-up and spotlight this far from the screen edges.
export const EDGE = 12;
// Room between the target and the pop-up, where the arrow sits.
export const GAP = 16;
// The arrow stays this far from the pop-up's corners.
const ARROW_INSET = 22;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

// The target with some room around it, kept on screen (a target taller than the screen is cut
// to what is visible).
export function padRect(rect: Rect, pad: number, vw: number, vh: number): Rect {
  const x = clamp(rect.x - pad, EDGE / 2, vw);
  const y = clamp(rect.y - pad, EDGE / 2, vh);
  const right = clamp(rect.x + rect.w + pad, x, vw - EDGE / 2);
  const bottom = clamp(rect.y + rect.h + pad, y, vh - EDGE / 2);
  return { x, y, w: right - x, h: bottom - y };
}

// The overlap of two rectangles (zero size when they don't touch).
export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
}

// A clip-path: the whole screen with a rounded hole where `hole` is (even-odd fill).
export function spotlightPath(hole: Rect, vw: number, vh: number, radius = 14): string {
  const r = Math.max(0, Math.min(radius, hole.w / 2, hole.h / 2));
  const { x, y, w, h } = hole;
  const n = (value: number) => Math.round(value * 10) / 10;
  return `path(evenodd, "M0 0H${n(vw)}V${n(vh)}H0Z` +
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}` +
    `V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}` +
    `H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}` +
    `V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z")`;
}

// Where the pop-up of size `box` goes beside `target`: the preferred side if it fits, else the
// first of below, above, right and left that does. `arrow` is how far along the pop-up's facing
// edge the arrow points at the target's centre. With no target, or no room on any side, the
// pop-up is centred (no arrow).
export function placePopover(target: Rect | null, box: { w: number; h: number }, vw: number, vh: number, preferred?: Side): Placement {
  const centred: Placement = { x: (vw - box.w) / 2, y: clamp((vh - box.h) / 2, EDGE, vh - box.h - EDGE), side: "center", arrow: 0 };
  if (!target) return centred;
  const room: Record<Exclude<Side, "center">, number> = {
    bottom: vh - (target.y + target.h), top: target.y, right: vw - (target.x + target.w), left: target.x,
  };
  const needs = (side: Exclude<Side, "center">) => (side === "top" || side === "bottom" ? box.h : box.w) + GAP + EDGE;
  const order = [preferred, "bottom", "top", "right", "left"].filter((side): side is Exclude<Side, "center"> => !!side && side !== "center");
  const side = order.find((candidate) => room[candidate] >= needs(candidate));
  if (!side) return { ...centred, y: vh - box.h - EDGE };

  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  if (side === "top" || side === "bottom") {
    const x = clamp(cx - box.w / 2, EDGE, vw - box.w - EDGE);
    const y = side === "bottom" ? target.y + target.h + GAP : target.y - GAP - box.h;
    return { x, y, side, arrow: clamp(cx - x, ARROW_INSET, box.w - ARROW_INSET) };
  }
  const y = clamp(cy - box.h / 2, EDGE, vh - box.h - EDGE);
  const x = side === "right" ? target.x + target.w + GAP : target.x - GAP - box.w;
  return { x, y, side, arrow: clamp(cy - y, ARROW_INSET, box.h - ARROW_INSET) };
}

// Moves `from` towards `to` for a frame of `dtMs`, easing out (about 90% of the way in 140 ms).
export function approach(from: number, to: number, dtMs: number, timeMs = 60): number {
  const next = from + (to - from) * (1 - Math.exp(-dtMs / timeMs));
  return Math.abs(to - next) < 0.5 ? to : next;
}
