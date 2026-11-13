"use client";

import { RefObject, useLayoutEffect, useRef } from "react";

// Smoothly moves items (elements with data-flip-id inside container) from where they were to where
// they are now, whenever layoutKey changes: e.g. queue cards gathering into their family's box.
// Positions are taken relative to the container, so scrolling in between is not animated. An item
// re-created elsewhere (a new parent) still moves, since it is matched by its id.
export function useFlip(container: RefObject<HTMLElement | null>, layoutKey: string) {
  const positions = useRef(new Map<string, { left: number; top: number }>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root || typeof root.getBoundingClientRect !== "function") return;
    const origin = root.getBoundingClientRect();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-flip-id]"));
    const next = new Map<string, { left: number; top: number }>();
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      next.set(item.dataset.flipId!, { left: rect.left - origin.left, top: rect.top - origin.top });
    }
    // How far an item moved; an item inside another moving item (a card in a moving box) moves with
    // it, so only its own share is animated.
    const moved = (item: HTMLElement | null | undefined) => {
      const before = item && positions.current.get(item.dataset.flipId!);
      const now = item && next.get(item.dataset.flipId!);
      return before && now ? { dx: before.left - now.left, dy: before.top - now.top } : null;
    };
    const shift = (item: HTMLElement) => {
      const own = moved(item);
      const parent = moved(item.parentElement?.closest<HTMLElement>("[data-flip-id]"));
      return own && parent ? { dx: own.dx - parent.dx, dy: own.dy - parent.dy } : own;
    };
    if (!reduceMotion) {
      for (const item of items) {
        const delta = shift(item);
        if (!delta || typeof item.animate !== "function") continue;
        if (Math.abs(delta.dx) < 1 && Math.abs(delta.dy) < 1) continue;
        item.animate(
          [{ translate: `${delta.dx}px ${delta.dy}px` }, { translate: "0 0" }],
          { duration: 320, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" },
        );
      }
    }
    positions.current = next;
  }, [container, layoutKey]);
}
