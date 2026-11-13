"use client";

import { PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";

// Dragging cards onto each other with mouse, pen or touch (pointer events, no library, so it works
// offline on any device). A card is an element with data-drop-id; while dragged it follows the
// pointer, and the card under the pointer is reported as the drop target (null: none, STAY: its own
// group's box, EMPTY: empty space in the list). A floating copy follows the pointer, so the list
// never scrolls or changes size. A press that hardly moves is not a drag: it stays a click.
const DRAG_THRESHOLD_PX = 6;

// A copy of the card that follows the pointer, fixed over the page: it never widens or scrolls the
// list, so its scrollbars stay as they are.
function floatingCopy(card: HTMLElement): HTMLElement {
  const rect = card.getBoundingClientRect();
  const copy = card.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-drop-id");
  copy.removeAttribute("data-flip-id");
  copy.setAttribute("aria-hidden", "true");
  Object.assign(copy.style, {
    position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    margin: "0", zIndex: "1000", pointerEvents: "none", boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
    transition: "box-shadow 150ms", cursor: "grabbing",
  });
  document.body.appendChild(copy);
  return copy;
}

function fadeAway(copy: HTMLElement) {
  copy.style.transition = "opacity 140ms ease-out, scale 140ms ease-out";
  copy.style.opacity = "0";
  copy.style.scale = "0.96";
  setTimeout(() => copy.remove(), 160);
}

// Dropped here, the card stays where it is (e.g. in its own family's box, between cards).
export const STAY = 0;
// Dropped on empty space in the list (data-drop-list), away from every card and box.
export const EMPTY = -1;

// The card under the pointer. Over a group's box (data-drop-box) but between its cards: STAY for the
// dragged card's own box, else the box's first card, so the card joins that group.
function dropTargetAt(x: number, y: number, dragged: HTMLElement): number | null {
  for (const node of document.elementsFromPoint(x, y)) {
    // The dragged card itself (left in place) is not a target, nor is its box seen through it.
    if (dragged.contains(node)) continue;
    const card = node.closest<HTMLElement>("[data-drop-id]");
    if (card && card !== dragged) return Number(card.dataset.dropId);
    const box = node.closest<HTMLElement>("[data-drop-box]");
    if (box) {
      if (box.contains(dragged)) return STAY;
      const first = box.querySelector<HTMLElement>("[data-drop-id]");
      if (first) return Number(first.dataset.dropId);
    }
    if (node.closest("[data-drop-list]")) return EMPTY;
  }
  // Below a short list, still within the queue's scrolling area, is empty space too.
  const list = document.querySelector<HTMLElement>("[data-drop-list]");
  const area = list?.parentElement?.getBoundingClientRect();
  if (area && x >= area.left && x <= area.right && y >= area.top && y <= area.bottom) return EMPTY;
  return null;
}

export function useCardDrag(onDrop: (draggedId: number, targetId: number | null) => void) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  // Set after a drag, so the click the browser sends on release does not also pick the card.
  const justDragged = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>, id: number) => {
    if (event.button !== 0 || (event.target as Element).closest("[data-no-drag]")) return;
    const card = event.currentTarget;
    const start = { x: event.clientX, y: event.clientY };
    let dragging = false;
    let target: number | null = null;
    let ghost: HTMLElement | null = null;
    justDragged.current = false;

    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        card.setPointerCapture?.(moveEvent.pointerId);
        ghost = floatingCopy(card);
        setDraggingId(id);
      }
      ghost!.style.transform = `translate(${dx}px, ${dy}px) scale(1.04) rotate(-1deg)`;
      const next = dropTargetAt(moveEvent.clientX, moveEvent.clientY, card);
      if (next !== target) {
        target = next;
        setOverId(next);
      }
    };

    const finish = (dropped: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (!dragging) return;
      justDragged.current = true;
      // In case the browser sends no click for this release.
      setTimeout(() => { justDragged.current = false; }, 300);
      fadeAway(ghost!);
      setDraggingId(null);
      setOverId(null);
      if (dropped) onDrop(id, target);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }, [onDrop]);

  // For the card's click handler: true (once) when the click only ends a drag.
  const consumeDragClick = useCallback(() => {
    const was = justDragged.current;
    justDragged.current = false;
    return was;
  }, []);

  return { draggingId, overId, onPointerDown, consumeDragClick };
}
