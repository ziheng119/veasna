import { useLayoutEffect, useRef } from "react";

const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Animates a reordered list (FLIP): each child marked `data-flip-key` glides from its old
 * position to its new one, and newly added children fade in. Positions use offsetTop, so a
 * container that is itself animating (e.g. a dialog zooming in) does not cause false moves.
 * Skipped when the user prefers reduced motion or the browser lacks the Web Animations API.
 */
export function useFlipAnimation<T extends HTMLElement>(keys: readonly string[]) {
  const containerRef = useRef<T>(null);
  const positions = useRef<Map<string, number> | null>(null);
  const signature = keys.join("|");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const previous = positions.current;
    const next = new Map<string, number>();

    container.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((node) => {
      const key = node.dataset.flipKey as string;
      const top = node.offsetTop;
      next.set(key, top);
      // First render: record positions only, so opening the list does not animate every row.
      if (!previous || reduceMotion || typeof node.animate !== "function") return;
      const before = previous.get(key);
      if (before === undefined) {
        node.animate(
          [{ opacity: 0, transform: "translateY(-6px) scale(0.98)" }, { opacity: 1, transform: "none" }],
          { duration: 220, easing: EASING },
        );
      } else if (before !== top) {
        node.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], { duration: 260, easing: EASING });
      }
    });
    positions.current = next;
  }, [signature]);

  return containerRef;
}
