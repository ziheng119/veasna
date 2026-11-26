"use client";

import { KeyboardEvent, PointerEvent, RefObject, useCallback, useEffect, useState } from "react";

// The queue's share of a station surface's width, in percent, while it is open (not folded): about
// a quarter, room for a card's number, names and actions, leaving the rest to the patient.
export const DEFAULT_QUEUE_SHARE = 29;
// Neither column gets narrower than this.
const MIN_QUEUE_PX = 256;
const MIN_WORK_PX = 448;
const STORAGE_KEY = "veasna-split:queue";

/** The queue's share of the width, remembered on this device (default until it is read). */
export function useQueueShare(): [number, (share: number) => void, (share: number) => void] {
  const [share, setShare] = useState(DEFAULT_QUEUE_SHARE);
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      if (stored > 0 && stored < 100) setShare(stored);
    } catch { /* private window or blocked storage: the default */ }
  }, []);
  const remember = useCallback((next: number) => {
    setShare(next);
    try { window.localStorage.setItem(STORAGE_KEY, next.toFixed(2)); } catch { /* not remembered */ }
  }, []);
  return [share, setShare, remember];
}

interface Props {
  // The two-column grid being split.
  gridRef: RefObject<HTMLDivElement | null>;
  share: number;
  // While dragging; `onCommit` once let go (or for each key press), to remember it.
  onChange: (share: number) => void;
  onCommit: (share: number) => void;
}

/**
 * The line between the queue and the open patient, dragged to give either more room. Arrow keys
 * move it too (Shift for bigger steps), Home and End go to the narrowest and widest queue, and a
 * double-click puts it back. Hidden below 1024px, where the queue sits above the patient, and while
 * the queue is folded. Sits in the patient's column, over its left edge.
 */
export default function SplitDivider({ gridRef, share, onChange, onCommit }: Props) {
  const [dragging, setDragging] = useState(false);

  // The share for a queue `px` wide, kept within both columns' minimum widths.
  const shareFor = (px: number) => {
    const width = gridRef.current?.getBoundingClientRect().width ?? 0;
    if (!width) return share;
    const max = Math.max(MIN_QUEUE_PX, width - MIN_WORK_PX);
    return (Math.min(Math.max(px, MIN_QUEUE_PX), max) / width) * 100;
  };
  const queuePx = () => ((gridRef.current?.getBoundingClientRect().width ?? 0) * share) / 100;

  // No column glide while dragging: the line follows the pointer.
  const setResizing = (on: boolean) => {
    const grid = gridRef.current;
    if (!grid) return;
    if (on) grid.dataset.resizing = ""; else delete grid.dataset.resizing;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setResizing(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !gridRef.current) return;
    onChange(shareFor(event.clientX - gridRef.current.getBoundingClientRect().left));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    setResizing(false);
    onCommit(share);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const width = gridRef.current?.getBoundingClientRect().width ?? 0;
    const step = (event.shiftKey ? 0.1 : 0.02) * width;
    const next = event.key === "ArrowLeft" ? shareFor(queuePx() - step)
      : event.key === "ArrowRight" ? shareFor(queuePx() + step)
      : event.key === "Home" ? shareFor(0)
      : event.key === "End" ? shareFor(width)
      : null;
    if (next === null) return;
    event.preventDefault();
    onCommit(next);
  };

  return (
    <div className="relative z-30 hidden w-0 lg:col-start-2 lg:row-start-1 lg:block lg:group-has-[[data-queue-compact]]/split:hidden">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the queue"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share)}
        aria-valuetext={`Queue ${Math.round(share)}% of the width`}
        title="Drag to resize. Double-click to reset."
        tabIndex={0}
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onCommit(DEFAULT_QUEUE_SHARE)}
        onKeyDown={onKeyDown}
        className="group/handle absolute inset-y-0 -left-2 w-4 cursor-col-resize touch-none select-none focus-visible:outline-none"
      >
        {/* The line lights up in brand blue on hover, focus and while dragging. */}
        <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors duration-150 group-hover/handle:bg-primary/40 group-focus-visible/handle:bg-primary group-data-dragging/handle:bg-primary motion-reduce:transition-none" />
        {/* A grip halfway down, so the line reads as something to drag. */}
        <span aria-hidden="true" className="absolute top-1/2 left-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card shadow-sm transition-colors duration-150 group-hover/handle:border-primary/50 group-focus-visible/handle:border-primary group-data-dragging/handle:border-primary motion-reduce:transition-none" />
      </div>
    </div>
  );
}
