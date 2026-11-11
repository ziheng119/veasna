"use client";

// The guided tour started from the ? button (GuideButton): a spotlight moves over the real pages,
// step by step (lib/guide/steps.ts), with a pop-up pointing at what each step is about.
// - Everything else is dimmed and blurred. The page can't be clicked or typed into during the tour,
//   so nothing is changed by accident; clicking it nudges the pop-up instead. Scrolling still works.
// - The spotlight and pop-up glide between steps and follow the page as it scrolls or resizes
//   (one animation frame loop writing styles directly, no re-render per frame).
// - Next/Back, the arrow keys, Esc and ✕ work at any time; focus stays in the pop-up.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUIDE_STEPS } from "@/lib/guide/steps";
import { approach, padRect, placePopover, spotlightPath, type Rect, type Side } from "@/lib/guide/geometry";
import { useGuideStore } from "@/stores/useGuideStore";
import { ENTER_FAST, PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Room around the lit part, in pixels.
const PAD = 8;
// A step whose part hasn't appeared by then shows its pop-up in the middle of the screen.
const FIND_TIMEOUT_MS = 4000;
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
  useEffect(() => {
    if (active) { setMounted(true); return; }
    const timer = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [active]);
  if (!mounted && !active) return null;
  return <Tour closing={!active} />;
}

const visible = (rect: DOMRect) => rect.width > 0 && rect.height > 0;

// The first part of the page marked data-tour=`name` that is showing.
function findTarget(name: string): HTMLElement | null {
  const found = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return found.find((element) => visible(element.getBoundingClientRect())) ?? null;
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
  const ringRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("finding");

  // Read by the frame loop.
  const live = useRef({ index, pathname });
  live.current = { index, pathname };

  // Each step opens its page. Leaving the tour goes back to the page it was started from.
  const startedOn = useRef("");
  useEffect(() => { startedOn.current = location.pathname + location.search; }, []);
  useEffect(() => {
    if (!closing && step.path && step.path !== pathname) router.push(step.path);
  }, [closing, step.path, pathname, router]);
  useEffect(() => {
    if (closing && startedOn.current && startedOn.current !== location.pathname + location.search) router.push(startedOn.current);
  }, [closing, router]);

  // Focus moves into the pop-up, and back to the ? button afterwards.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
    return () => document.querySelector<HTMLElement>('[data-tour="guide-button"]')?.focus({ preventScroll: true });
  }, []);
  useEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, [index]);

  // The frame loop: finds each step's part, then moves the spotlight and pop-up towards it.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = document.querySelector('[data-tour="guide-button"]')?.getBoundingClientRect();
    // The spotlight opens out of the ? button.
    const hole: Rect = start ? { x: start.left, y: start.top, w: start.width, h: start.height } : { x: innerWidth / 2, y: innerHeight / 2, w: 0, h: 0 };
    const pop = { x: (innerWidth - 340) / 2, y: innerHeight / 2, arrow: 0 };
    let session = { index: -1, startedAt: 0, tabDone: false, scrolled: false, status: "finding" as Status };
    let lastPath = "", lastRing = "", side: Side = "center";
    let previous = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = reduced ? Infinity : Math.min(now - previous, 64);
      previous = now;
      const { index: current, pathname: path } = live.current;
      const step = GUIDE_STEPS[current];
      if (session.index !== current) session = { index: current, startedAt: now, tabDone: !step.tab, scrolled: false, status: "finding" };
      const onPage = !step.path || path === step.path;
      const vw = innerWidth, vh = innerHeight;

      // Switch a registration tab first: only changes what is shown.
      if (onPage && !session.tabDone) {
        const tab = document.querySelector<HTMLElement>(`[data-tour-tab="${step.tab}"]`);
        if (tab) {
          if (tab.getAttribute("data-state") !== "active") tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          session.tabDone = true;
        }
      }

      let target: Rect | null = null;
      const element = step.target && onPage && session.tabDone ? findTarget(step.target) : null;
      if (element) {
        const rect = element.getBoundingClientRect();
        if (!session.scrolled) {
          session.scrolled = true;
          if (rect.top < 72 || rect.bottom > vh - 24) {
            element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: rect.height > vh * 0.7 ? "start" : "center" });
          }
        }
        target = padRect({ x: rect.left, y: rect.top, w: rect.width, h: rect.height }, PAD, vw, vh);
      }
      const stillLooking = !!step.target && !target && now - session.startedAt < FIND_TIMEOUT_MS;
      const status: Status = target ? "found" : stillLooking ? "finding" : step.target ? "missing" : "found";
      if (status !== session.status) { session.status = status; setStatus(status); }

      // While a part is still loading, the spotlight waits where it is; with none, it closes.
      const goal = target ?? (stillLooking ? hole : { x: vw / 2, y: vh / 2, w: 0, h: 0 });
      hole.x = approach(hole.x, goal.x, dt); hole.y = approach(hole.y, goal.y, dt);
      hole.w = approach(hole.w, goal.w, dt); hole.h = approach(hole.h, goal.h, dt);

      const clip = spotlightPath(hole, vw, vh);
      if (clip !== lastPath && dimRef.current) {
        lastPath = clip;
        dimRef.current.style.clipPath = clip;
        dimRef.current.style.setProperty("-webkit-clip-path", clip);
      }
      const ring = `${hole.x}|${hole.y}|${hole.w}|${hole.h}`;
      if (ring !== lastRing && ringRef.current) {
        lastRing = ring;
        Object.assign(ringRef.current.style, {
          transform: `translate3d(${hole.x}px, ${hole.y}px, 0)`, width: `${hole.w}px`, height: `${hole.h}px`,
          opacity: hole.w > 6 && hole.h > 6 ? "1" : "0",
        });
      }

      const box = popRef.current;
      if (box) {
        const placement = placePopover(stillLooking && hole.w > 6 ? hole : target, { w: box.offsetWidth, h: box.offsetHeight }, vw, vh, step.side);
        pop.x = approach(pop.x, placement.x, dt); pop.y = approach(pop.y, placement.y, dt);
        pop.arrow = placement.side === side ? approach(pop.arrow, placement.arrow, dt) : placement.arrow;
        side = placement.side;
        box.style.transform = `translate3d(${pop.x}px, ${pop.y}px, 0)`;
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
  const centred = !step.target || status === "missing";

  return (
    <div ref={rootRef} className={cn("fixed inset-0 z-[70] transition-opacity duration-200", closing ? "pointer-events-none opacity-0" : "opacity-100 animate-in fade-in duration-300")}>
      {/* Dims and blurs everything but the lit part. */}
      <div ref={dimRef} className="guide-dim" aria-hidden="true" />
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
        <div ref={cardRef} className="relative rounded-2xl border border-border bg-card/95 text-card-foreground shadow-2xl ring-1 ring-primary/15 backdrop-blur-md">
          <span ref={arrowRef} className="guide-arrow" aria-hidden="true" />
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{step.chapter}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{index + 1} / {GUIDE_STEPS.length}</span>
              <button type="button" onClick={stop} aria-label="Exit the guide" title="Exit (Esc)"
                className={cn("-mr-1 rounded-full p-1 text-muted-foreground transition-[background-color,color,transform] hover:rotate-90 hover:bg-accent hover:text-foreground motion-reduce:transform-none", PRESS)}>
                <X className="size-4" />
              </button>
            </div>
            <div key={index} className={ENTER_FAST} aria-live="polite">
              <h2 id={titleId} className="mt-3 flex items-center gap-2 text-base font-semibold">
                {centred && <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                {step.title}
              </h2>
              <p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              {status === "finding" && step.target && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {!step.path || step.path === pathname ? "Finding it on the page…" : `Opening ${step.chapter}…`}
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
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400 transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={back} disabled={index === 0} className={cn("gap-1", PRESS)}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Back
              </Button>
              {index === 0 && <span className="hidden text-[11px] text-muted-foreground sm:inline">← → keys · Esc to exit</span>}
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
