"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

interface Props<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  // Name of an item, for the drag handle's label ("Drag to move Triage").
  getLabel: (item: T) => string;
  onReorder: (from: number, to: number) => void;
  // The row's content; `handle` is the drag grip, placed wherever the row wants it.
  renderItem: (item: T, index: number, handle: ReactNode, dragging: boolean) => ReactNode;
  disabled?: boolean;
  className?: string;
  itemClassName?: string | ((item: T, index: number) => string);
  "aria-label"?: string;
}

interface Drag {
  index: number;
  pointerId: number;
  startY: number;
  dy: number;
  over: number;
  // Row positions when the drag started (viewport px), and the space each neighbour moves by.
  rects: { top: number; height: number }[];
  shift: number;
}

/**
 * A list reordered by dragging each row's grip (mouse, pen or touch). The row lifts and follows
 * the pointer, the others slide aside to show where it will land, and it settles into place on
 * release. With the keyboard, focus a grip and press the up/down arrows. Any other change to the
 * list (added, removed or moved by a button) glides too. Reduced-motion users get no animation.
 */
export default function SortableList<T>({
  items, getKey, getLabel, onReorder, renderItem, disabled = false, className, itemClassName, ...rest
}: Props<T>) {
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Set on drop: the dropped row's offset from its new slot, so it settles from where it was let go.
  const settle = useRef<{ key: string; dy: number } | null>(null);
  const positions = useRef<Map<string, number> | null>(null);
  const signature = items.map(getKey).join("|");

  // FLIP: rows glide from their old position to the new one; new rows fade in.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const previous = positions.current;
    const dropped = settle.current;
    settle.current = null;
    const next = new Map<string, number>();
    list.querySelectorAll<HTMLElement>(":scope > [data-sort-key]").forEach((node) => {
      const key = node.dataset.sortKey as string;
      next.set(key, node.offsetTop);
      if (!previous || reduceMotion || typeof node.animate !== "function") return;
      if (dropped) {
        // Neighbours were already shown in their new places while dragging; only the dropped row moves.
        if (key === dropped.key && dropped.dy !== 0) {
          node.animate([{ transform: `translateY(${dropped.dy}px) scale(1.02)` }, { transform: "none" }], { duration: 220, easing: EASING });
        }
        return;
      }
      const before = previous.get(key);
      if (before === undefined) {
        node.animate([{ opacity: 0, transform: "translateY(-6px) scale(0.98)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: EASING });
      } else if (before !== node.offsetTop) {
        node.animate([{ transform: `translateY(${before - node.offsetTop}px)` }, { transform: "none" }], { duration: 260, easing: EASING });
      }
    });
    positions.current = next;
  }, [signature]);

  const rows = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>(":scope > [data-sort-key]") ?? []);

  const start = (event: React.PointerEvent<HTMLElement>, index: number) => {
    if (disabled || event.button > 0 || items.length < 2) return;
    const nodes = rows();
    if (nodes.length !== items.length) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rects = nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top, height: box.height };
    });
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - (rects[0].top + rects[0].height)) : 0;
    setDrag({ index, pointerId: event.pointerId, startY: event.clientY, dy: 0, over: index, rects, shift: rects[index].height + gap });
  };

  const move = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dy = event.clientY - drag.startY;
    const { rects, index } = drag;
    const center = rects[index].top + rects[index].height / 2 + dy;
    let over = index;
    rects.forEach((rect, i) => {
      const middle = rect.top + rect.height / 2;
      if (i > index && center > middle) over = Math.max(over, i);
      if (i < index && center < middle) over = Math.min(over, i);
    });
    setDrag({ ...drag, dy, over });
  };

  const end = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { index, over, rects, dy } = drag;
    setDrag(null);
    if (over === index) return;
    // Where the dropped row's top ends up, so it can settle from where it was released.
    const landing = over > index ? rects[over].top + rects[over].height - rects[index].height : rects[over].top;
    settle.current = { key: getKey(items[index]), dy: rects[index].top + dy - landing };
    onReorder(index, over);
  };

  const keyMove = (event: React.KeyboardEvent, index: number) => {
    if (disabled) return;
    const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : null;
    if (to === null) return;
    event.preventDefault();
    if (to >= 0 && to < items.length) onReorder(index, to);
  };

  // Where each row sits while dragging: the dragged one follows the pointer, the rest make room.
  const offset = (i: number) => {
    if (!drag) return 0;
    if (i === drag.index) return drag.dy;
    if (drag.index < i && i <= drag.over) return -drag.shift;
    if (drag.over <= i && i < drag.index) return drag.shift;
    return 0;
  };

  return (
    <ol ref={listRef} className={cn("relative space-y-2", drag && "select-none", className)} aria-label={rest["aria-label"]}>
      {items.map((item, index) => {
        const key = getKey(item);
        const dragging = drag?.index === index;
        const label = getLabel(item);
        const handle = (
          <button
            type="button"
            aria-label={`Drag to move ${label}`}
            title={disabled ? undefined : "Drag to reorder (or use the arrow keys)"}
            aria-roledescription="sortable"
            disabled={disabled}
            onPointerDown={(event) => start(event, index)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(event) => keyMove(event, index)}
            className={cn(
              "grid size-8 shrink-0 touch-none place-items-center rounded-md text-muted-foreground transition-[color,background-color,transform] duration-150",
              "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30",
              dragging ? "cursor-grabbing scale-110 text-foreground" : "cursor-grab",
            )}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        );
        return (
          <li
            key={key}
            data-sort-key={key}
            style={{
              transform: drag ? `translateY(${offset(index)}px)${dragging ? " scale(1.02)" : ""}` : undefined,
              transition: drag && !dragging ? `transform 200ms ${EASING}` : undefined,
            }}
            className={cn(
              "relative",
              typeof itemClassName === "function" ? itemClassName(item, index) : itemClassName,
              dragging && "z-10 shadow-lg ring-2 ring-primary/30",
            )}
          >
            {renderItem(item, index, handle, dragging)}
          </li>
        );
      })}
    </ol>
  );
}

/** Moves one item of a list, for onReorder. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
