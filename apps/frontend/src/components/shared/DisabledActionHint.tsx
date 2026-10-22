"use client";

import { ReactNode, useId, useState } from "react";
import { createPortal } from "react-dom";

/** A wrapper receives hover/focus events that disabled buttons cannot receive. */
export default function DisabledActionHint({ disabled, message, children }: {
  disabled: boolean;
  message: string;
  children: ReactNode;
}) {
  const id = useId();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const show = (x: number, y: number) => setPosition({
    x: Math.max(8, Math.min(x + 14, window.innerWidth - 248)),
    y: Math.max(8, Math.min(y + 14, window.innerHeight - 80)),
  });

  return (
    <span
      className="inline-flex"
      tabIndex={disabled ? 0 : undefined}
      aria-label={disabled ? message : undefined}
      aria-describedby={disabled && position ? id : undefined}
      onPointerMove={event => {
        if (disabled && event.pointerType !== "touch") show(event.clientX, event.clientY);
      }}
      onPointerLeave={() => setPosition(null)}
      onFocus={event => {
        if (!disabled) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        show(bounds.left, bounds.bottom);
      }}
      onBlur={() => setPosition(null)}
      onKeyDown={event => { if (event.key === "Escape") setPosition(null); }}
    >
      {children}
      {disabled && position && createPortal(
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none fixed z-50 w-60 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
          style={{ left: position.x, top: position.y }}
        >
          {message}
        </span>,
        document.body,
      )}
    </span>
  );
}
