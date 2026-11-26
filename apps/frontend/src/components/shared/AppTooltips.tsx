"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Shared with DisabledActionHint. Short text, wide letter spacing and a medium weight, for reading at a glance.
export const TOOLTIP_CLASS = "pointer-events-none fixed z-[60] max-w-64 rounded-md bg-foreground px-3 py-1.5 text-[13px] font-medium leading-snug tracking-[0.05em] text-background antialiased shadow-md";
const SHOW_DELAY_MS = 250;
const GAP = 6;

/**
 * The app's hover messages: any element with a `title` shows it in a styled tooltip instead of the
 * browser's own. While shown, the element's `title` is moved aside (so the browser's doesn't appear
 * too) and put back when the pointer leaves. Mounted once, in the root layout.
 */
export default function AppTooltips() {
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let target: Element | null = null;
    let text = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
      clearTimeout(timer);
      // Put the title back unless the page has set a new one meanwhile.
      if (target && !target.hasAttribute("title")) target.setAttribute("title", text);
      target = null;
      setTip(null);
    };
    const showFor = (element: Element, delay: number) => {
      if (element === target) return;
      hide();
      const title = element.getAttribute("title");
      if (!title) return;
      target = element;
      text = title;
      element.removeAttribute("title");
      timer = setTimeout(() => {
        if (target === element && element.isConnected) setTip({ text: title, rect: element.getBoundingClientRect() });
      }, delay);
    };
    const titled = (node: EventTarget | null) => node instanceof Element ? node.closest("[title]") : null;
    const over = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // Moving within the element keeps its tooltip.
      if (target && event.target instanceof Node && target.contains(event.target)) return;
      const element = titled(event.target);
      if (element) showFor(element, SHOW_DELAY_MS); else hide();
    };
    const out = (event: PointerEvent) => { if (!event.relatedTarget) hide(); };
    const focus = (event: FocusEvent) => {
      const element = titled(event.target);
      if (element && event.target instanceof Element && event.target.matches(":focus-visible")) showFor(element, 0);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, true);
    return () => {
      hide();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  // Below the element, centred and kept on screen; above it when there's no room below.
  useLayoutEffect(() => {
    const element = tipRef.current;
    if (!tip || !element) return setPlace(null);
    const { width, height } = element.getBoundingClientRect();
    const left = Math.max(8, Math.min(tip.rect.left + tip.rect.width / 2 - width / 2, window.innerWidth - width - 8));
    const below = tip.rect.bottom + GAP;
    setPlace({ left, top: below + height > window.innerHeight - 8 ? Math.max(8, tip.rect.top - GAP - height) : below });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <span ref={tipRef} role="tooltip" className={TOOLTIP_CLASS}
      style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? "visible" : "hidden" }}>
      {tip.text}
    </span>,
    document.body,
  );
}
