"use client";

// The guided tour started from the ? button (GuideButton): a spotlight moves over the real pages,
// step by step (lib/guide/steps.ts), with a pop-up pointing at what each step is about.
// - Everything else is dimmed and blurred. The page can't be clicked or typed into during the tour,
//   so nothing is changed by accident; clicking it nudges the pop-up instead. Scrolling still works.
// - Each part is scrolled fully into view first; the spotlight and pop-up then glide to it and
//   follow the page as it scrolls or resizes (one animation frame loop writing styles directly,
//   no re-render per frame).
// - Next/Back, the arrow keys, Esc and ✕ work at any time; focus stays in the pop-up.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUIDE_STEPS, stepPage } from "@/lib/guide/steps";
import { forgetSample, sampleWasShown } from "@/lib/guide/sample";
import { clearQueueCache } from "@/lib/api/queue/getQueue";
import { clearPatientListCache } from "@/lib/api/patients/getPatientList";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import { approach, intersect, padRect, placePopover, spotlightPath, type Rect, type Side } from "@/lib/guide/geometry";
import { useGuideStore } from "@/stores/useGuideStore";
import { ENTER_FAST, PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Room around the lit part, in pixels.
const PAD = 8;
// A step whose part hasn't appeared by then shows its pop-up in the middle of the screen.
const FIND_TIMEOUT_MS = 4000;
// After scrolling a part into view, the spotlight moves once the part has stopped moving for this
// many frames (or after SETTLE_MAX_MS at most), so it lands on the part instead of chasing it.
const SETTLE_FRAMES = 3;
const SETTLE_MAX_MS = 1200;
// The blur comes in once the spotlight is this close (in pixels) to where it is going.
const BLUR_NEAR = 32;
// How long the overlay takes to fade out after the tour ends.
const CLOSE_MS = 250;
const NUDGE_NOTE_MS = 2600;
// Where the ring and pop-up start before the first frame places them (no flash in a corner).
const INITIAL_RING = { opacity: 0 } as const;
const INITIAL_POPOVER = { transform: "translate3d(calc(50vw - 170px), 38vh, 0)" } as const;

type Status = "finding" | "found" | "missing";

export default function GuideTour() {
  const active = useGuideStore((state) => state.active);
  // Signing out (or anything else closing these pages) ends the tour, so it doesn't reappear later.
  useEffect(() => () => useGuideStore.getState().stop(), []);
  // Kept for a moment after the tour ends, so it can fade out.
  const [mounted, setMounted] = useState(false);
  const wasActive = useRef(false);
  useEffect(() => {
    // Lists load again with the sample patient in them, and again without it afterwards; pages
    // that showed it open fresh (GuidePage), so it isn't left on screen.
    if (active !== wasActive.current) {
      wasActive.current = active;
      clearQueueCache();
      clearPatientListCache();
      useRealtimeStore.getState().invalidate();
      if (!active && sampleWasShown()) {
        forgetSample();
        useGuideStore.getState().resetPages();
      }
    }
    if (active) { setMounted(true); return; }
    const timer = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [active]);
  if (!mounted && !active) return null;
  return <Tour closing={!active} />;
}

const toRect = (rect: DOMRect): Rect => ({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
const visible = (rect: DOMRect) => rect.width > 0 && rect.height > 0;

// The first part of the page marked data-tour=`name` that is showing.
function findTarget(name: string): HTMLElement | null {
  const found = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return found.find((element) => visible(element.getBoundingClientRect())) ?? null;
}

// The panels a part sits in that cut off what overflows them, innermost first.
function clippingParents(element: HTMLElement): HTMLElement[] {
  const parents: HTMLElement[] = [];
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(parent);
    if (/auto|scroll|hidden|clip/.test(overflowX + overflowY)) parents.push(parent);
  }
  return parents;
}

// The scrollable part of the page under a point (beneath the tour), for scrolling during the tour.
function scrollableAt(x: number, y: number, tour: HTMLElement): HTMLElement | null {
  let element = document.elementsFromPoint(x, y).find((candidate) => !tour.contains(candidate)) as HTMLElement | undefined;
  while (element) {
    const { overflowY } = getComputedStyle(element);
    if ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight) return element;
    element = element.parentElement ?? undefined;
  }
  return document.querySelector("main");
}

interface Session {
  index: number; startedAt: number; tabDone: boolean; status: Status;
  element: HTMLElement | null; parents: HTMLElement[]; radius: number;
  // When the part was scrolled into view (-1: not checked yet); frames it has been still since.
  scrolledAt: number; still: number; lastRect: string;
  // ready: done scrolling, the spotlight may go there; arrived: it is there.
  ready: boolean; arrived: boolean;
}
const newSession = (index: number, now: number): Session => ({
  index, startedAt: now, tabDone: !GUIDE_STEPS[index]?.tab, status: "finding",
  element: null, parents: [], radius: 12, scrolledAt: -1, still: 0, lastRect: "", ready: false, arrived: false,
});

function Tour({ closing }: { closing: boolean }) {
  const index = useGuideStore((state) => state.index);
  const { next, back, stop } = useGuideStore.getState();
  const step = GUIDE_STEPS[index];
  const last = index === GUIDE_STEPS.length - 1;
  const router = useRouter();
  const pathname = usePathname();
  const titleId = useId();
  const bodyId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("finding");

  // Read by the frame loop.
  const live = useRef({ index, pathname });
  live.current = { index, pathname };

  // Each step opens its page; the tour's pages are loaded ahead so switching is quick. Leaving
  // the tour goes back to the page it was started from.
  const startedOn = useRef("");
  useEffect(() => {
    startedOn.current = location.pathname + location.search;
    for (const path of new Set(GUIDE_STEPS.map(stepPage))) if (path) router.prefetch?.(path);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!closing && step.path && stepPage(step) !== pathname) router.push(step.path);
  }, [closing, step, pathname, router]);
  useEffect(() => {
    if (closing && startedOn.current && startedOn.current !== location.pathname + location.search) router.push(startedOn.current);
  }, [closing, router]);

  // Focus moves into the pop-up, and back to the ? button afterwards.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
    return () => document.querySelector<HTMLElement>('[data-tour="guide-button"]')?.focus({ preventScroll: true });
  }, []);
  useEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, [index]);

  // The frame loop: finds each step's part, scrolls it fully into view, then moves the spotlight
  // and pop-up to it. Per frame only cheap styles change (a plain dim layer's clip-path and
  // transforms); the blur is redrawn only once the spotlight has arrived.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = document.querySelector('[data-tour="guide-button"]')?.getBoundingClientRect();
    // The spotlight opens out of the ? button.
    const hole: Rect = start ? toRect(start) : { x: innerWidth / 2, y: innerHeight / 2, w: 0, h: 0 };
    let radius = 12;
    const pop = { x: (innerWidth - 340) / 2, y: innerHeight / 2, arrow: 0 };
    let session = newSession(-1, 0);
    let lastPath = "", lastBlur: string | null = null, lastRing = "", side: Side = "center";
    let previous = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = reduced ? Infinity : Math.min(now - previous, 64);
      previous = now;
      const { index: current, pathname: path } = live.current;
      const step = GUIDE_STEPS[current];
      if (session.index !== current) session = newSession(current, now);
      const onPage = !step.path || path === stepPage(step);
      const vw = innerWidth, vh = innerHeight;
      const screen: Rect = { x: 0, y: 0, w: vw, h: vh };
      // Read the pop-up's size before writing any style, so the page is laid out once a frame.
      const box = popRef.current ? { w: popRef.current.offsetWidth, h: popRef.current.offsetHeight } : null;

      // Switch a registration tab first: only changes what is shown.
      if (onPage && !session.tabDone) {
        const tab = document.querySelector<HTMLElement>(`[data-tour-tab="${step.tab}"]`);
        if (tab) {
          if (tab.getAttribute("data-state") !== "active") tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          session.tabDone = true;
        }
      }

      if (step.target && onPage && session.tabDone && !session.element?.isConnected) {
        const element = findTarget(step.target);
        if (element && element !== session.element) {
          Object.assign(session, {
            element, parents: clippingParents(element), scrolledAt: -1, still: 0, lastRect: "", ready: false,
            // Corners following the part's own, PAD further out, so the two look concentric.
            radius: (parseFloat(getComputedStyle(element).borderTopLeftRadius) || 4) + PAD,
          });
        }
      }

      let target: Rect | null = null;
      const element = session.element;
      if (element) {
        const rect = toRect(element.getBoundingClientRect());
        // What of it can be seen: inside the panels it scrolls in, and the screen.
        const area = session.parents.reduce((seen, parent) => intersect(seen, toRect(parent.getBoundingClientRect())), screen);
        const shown = intersect(rect, area);
        if (session.scrolledAt < 0) {
          session.scrolledAt = now;
          if (shown.w < rect.w - 1 || shown.h < rect.h - 1) {
            // Too tall to show whole: its top, with as much of it as fits.
            element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: rect.h > area.h - 2 * PAD ? "start" : "center", inline: "nearest" });
          } else session.ready = true;
        }
        if (!session.ready) {
          const key = `${rect.x}|${rect.y}|${rect.w}|${rect.h}`;
          session.still = key === session.lastRect ? session.still + 1 : 0;
          session.lastRect = key;
          session.ready = session.still >= SETTLE_FRAMES || now - session.scrolledAt > SETTLE_MAX_MS;
        }
        if (session.ready && shown.w > 0 && shown.h > 0) {
          // Room around it, but not out past the page's scrolling area (under the top bar).
          const outer = session.parents.length ? intersect(toRect(session.parents[session.parents.length - 1].getBoundingClientRect()), screen) : screen;
          target = intersect(padRect(shown, PAD, vw, vh), outer);
        }
      }
      const stillLooking = !!step.target && !target && now - session.startedAt < FIND_TIMEOUT_MS;
      const status: Status = target ? "found" : stillLooking ? "finding" : step.target ? "missing" : "found";
      if (status !== session.status) { session.status = status; setStatus(status); }

      // While a part is loading or scrolling, the spotlight waits where it is; with none, it
      // closes. Once it has arrived it follows the part exactly as the page scrolls.
      const goal = target ?? (stillLooking ? { ...hole } : { x: vw / 2, y: vh / 2, w: 0, h: 0 });
      if (session.arrived && target) Object.assign(hole, goal);
      else {
        hole.x = approach(hole.x, goal.x, dt); hole.y = approach(hole.y, goal.y, dt);
        hole.w = approach(hole.w, goal.w, dt); hole.h = approach(hole.h, goal.h, dt);
      }
      radius = approach(radius, session.radius, dt);
      if (target && hole.x === goal.x && hole.y === goal.y && hole.w === goal.w && hole.h === goal.h) session.arrived = true;

      const clip = spotlightPath(hole, vw, vh, radius);
      if (clip !== lastPath && dimRef.current) {
        lastPath = clip;
        dimRef.current.style.clipPath = clip;
        dimRef.current.style.setProperty("-webkit-clip-path", clip);
      }
      // Blurring costs a full redraw whenever its shape changes, so it is off while the spotlight
      // travels and comes in for its last few pixels (or when there is nothing to light up).
      const near = !!target && Math.max(Math.abs(hole.x - target.x), Math.abs(hole.y - target.y),
        Math.abs(hole.x + hole.w - target.x - target.w), Math.abs(hole.y + hole.h - target.y - target.h)) < BLUR_NEAR;
      const blur = session.arrived || near || !step.target || status === "missing" ? clip : "";
      if (blur !== lastBlur && blurRef.current) {
        lastBlur = blur;
        if (blur) { blurRef.current.style.clipPath = blur; blurRef.current.style.setProperty("-webkit-clip-path", blur); }
        blurRef.current.style.opacity = blur ? "1" : "0";
      }
      const ring = `${hole.x}|${hole.y}|${hole.w}|${hole.h}|${radius}`;
      if (ring !== lastRing && ringRef.current) {
        lastRing = ring;
        Object.assign(ringRef.current.style, {
          transform: `translate3d(${hole.x}px, ${hole.y}px, 0)`, width: `${hole.w}px`, height: `${hole.h}px`,
          borderRadius: `${Math.min(radius, hole.w / 2, hole.h / 2)}px`,
          opacity: hole.w > 6 && hole.h > 6 ? "1" : "0",
        });
      }

      if (box && popRef.current) {
        const placement = placePopover(stillLooking && hole.w > 6 ? hole : target, box, vw, vh, step.side);
        if (session.arrived && target) Object.assign(pop, { x: placement.x, y: placement.y, arrow: placement.arrow });
        else {
          pop.x = approach(pop.x, placement.x, dt); pop.y = approach(pop.y, placement.y, dt);
          pop.arrow = placement.side === side ? approach(pop.arrow, placement.arrow, dt) : placement.arrow;
        }
        side = placement.side;
        popRef.current.style.transform = `translate3d(${pop.x}px, ${pop.y}px, 0)`;
        const arrow = arrowRef.current;
        if (arrow) {
          arrow.dataset.side = side;
          const along = `${pop.arrow - 7}px`;
          arrow.style.left = side === "top" || side === "bottom" ? along : "";
          arrow.style.top = side === "left" || side === "right" ? along : "";
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Clicking the paused page: the pop-up gives a small shake and says why nothing happened.
  const [nudgeNote, setNudgeNote] = useState(0);
  const nudgePopover = useCallback(() => {
    setNudgeNote((count) => count + 1);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cardRef.current?.animate(
        [0, -6, 6, -3, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
        { duration: 420, easing: "cubic-bezier(.36,.07,.19,.97)" },
      );
    }
  }, []);
  useEffect(() => {
    if (!nudgeNote) return;
    const timer = setTimeout(() => setNudgeNote(0), NUDGE_NOTE_MS);
    return () => clearTimeout(timer);
  }, [nudgeNote]);

  // Keys work wherever focus is; Tab stays inside the pop-up.
  useEffect(() => {
    if (closing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); stop(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); back(); }
      else if (event.key === "Tab" && popRef.current) {
        const focusable = Array.from(popRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (!focusable.length) return;
        const at = focusable.indexOf(document.activeElement as HTMLElement);
        const to = event.shiftKey ? (at <= 0 ? focusable.length - 1 : at - 1) : (at === focusable.length - 1 ? 0 : at + 1);
        event.preventDefault();
        focusable[to].focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [closing, next, back, stop]);

  const progress = ((index + 1) / GUIDE_STEPS.length) * 100;
  return (
    <div ref={rootRef} className={cn("fixed inset-0 z-[70] transition-opacity duration-200", closing ? "pointer-events-none opacity-0" : "opacity-100 animate-in fade-in duration-300")}>
      {/* Dim and blur everything but the lit part. */}
      <div ref={dimRef} className="guide-dim" aria-hidden="true" />
      <div ref={blurRef} className="guide-blur" aria-hidden="true" />
      {/* Takes every click and touch, so the page can't be changed during the tour. */}
      <div className="absolute inset-0" aria-hidden="true"
        onPointerDown={nudgePopover}
        onWheel={(event) => {
          if (rootRef.current) scrollableAt(event.clientX, event.clientY, rootRef.current)?.scrollBy({ top: event.deltaY, left: event.deltaX });
        }} />
      <div ref={ringRef} className="guide-ring" aria-hidden="true" style={INITIAL_RING}>
        {status === "found" && step.target && <span key={index} className="guide-ripple" />}
      </div>

      <div ref={popRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
        className="fixed left-0 top-0 w-[min(340px,calc(100vw-24px))] will-change-transform" style={INITIAL_POPOVER}>
        <div ref={cardRef} className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xl">
          <span ref={arrowRef} className="guide-arrow" aria-hidden="true" />
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">{step.chapter}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{index + 1} of {GUIDE_STEPS.length}</span>
              <button type="button" onClick={stop} aria-label="Exit the guide" title="Exit (Esc)"
                className={cn("-mr-1 rounded-full p-1 text-muted-foreground transition-[background-color,color,transform] hover:rotate-90 hover:bg-accent hover:text-foreground motion-reduce:transform-none", PRESS)}>
                <X className="size-4" />
              </button>
            </div>
            <div key={index} className={ENTER_FAST} aria-live="polite">
              <h2 id={titleId} className="mt-1.5 text-base font-semibold leading-snug">{step.title}</h2>
              <p id={bodyId} className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              {status === "finding" && step.target && (
                // Shown only if finding takes a moment, so a quick step doesn't flash it.
                <p className="guide-later mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {!step.path || stepPage(step) === pathname ? "Finding it on the page…" : `Opening ${step.chapter}…`}
                </p>
              )}
              {status === "missing" && (
                <p className="mt-2 text-xs text-muted-foreground">This part isn&apos;t showing on this screen right now.</p>
              )}
              {nudgeNote > 0 && (
                <p role="status" className={cn("mt-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary", ENTER_FAST)}>
                  The page is paused during the guide. Exit with ✕ or Esc to use it.
                </p>
              )}
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              {/* -ml-2: the ghost button's arrow lines up with the text above, not its padding. */}
              <Button type="button" variant="ghost" size="sm" onClick={back} disabled={index === 0}
                className={cn("-ml-2 gap-1", index === 0 && "invisible", PRESS)}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Back
              </Button>
              <Button ref={nextRef} type="button" size="sm" onClick={next} className={cn("group gap-1", PRESS)}>
                {last ? <>Finish <Check className="size-4" aria-hidden="true" /></>
                  : <>{index === 0 ? "Start" : "Next"} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /></>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
