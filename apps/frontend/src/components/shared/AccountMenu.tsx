"use client";

import { ComponentType, PointerEvent, useState } from "react";
import { createPortal } from "react-dom";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccountMenuItem {
  label: string;
  // Shown beside the pointer while it is over the item (and read out by screen readers).
  description: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  // Starts a group of its own, below a thin line (e.g. Log out).
  separated?: boolean;
}

// The trigger's height (h-9): the menu opens over the button, so its first row lines up with it.
const TRIGGER_HEIGHT = 36;
// Room between the pointer and its description.
const TIP_OFFSET = 14;
const TIP_WIDTH = 240;

/**
 * The account button at the right of the top bar. Opening it grows the button itself into the menu
 * (globals.css .account-menu): the panel starts exactly over the button and widens and lengthens
 * from there, with the username staying where it was. Hovering an option shows what it does next
 * to the pointer, following it.
 */
export default function AccountMenu({ username, items }: { username: string; items: AccountMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const follow = (text: string) => (event: PointerEvent) => {
    // Touch has no hover: the label says enough, and a tip would cover the menu.
    if (event.pointerType === "touch") return;
    setTip({ text, x: event.clientX, y: event.clientY });
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setTip(null);
  };
  // Near the right edge (where this menu sits) the tip goes to the left of the pointer.
  const flip = tip !== null && typeof window !== "undefined" && tip.x + TIP_OFFSET + TIP_WIDTH > window.innerWidth - 8;

  return (
    <Menu.Root open={open} onOpenChange={changeOpen} modal={false}>
      <Menu.Trigger asChild>
        <button type="button"
          className={cn(
            "group inline-flex h-9 items-center gap-2 rounded-lg bg-accent/60 px-3 text-sm font-semibold text-foreground outline-none",
            "transition-[background-color,transform] duration-200 hover:bg-accent active:scale-95 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none",
            // The open menu's top row takes its place.
            "data-[state=open]:invisible",
          )}>
          {username}
          <ChevronDown className="size-4 transition-transform duration-300 group-hover:translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" side="bottom" sideOffset={-TRIGGER_HEIGHT} avoidCollisions={false}
          // The shadow is a filter on this wrapper, so it follows the panel's shape as it grows.
          className="account-menu z-50 outline-none">
          <div className="account-menu-panel min-w-[max(var(--radix-dropdown-menu-trigger-width),14rem)] overflow-hidden rounded-xl bg-popover text-popover-foreground">
            {/* The button, now the menu's top row: clicking it closes the menu. */}
            <button type="button" onClick={() => changeOpen(false)} aria-label="Close menu"
              className="flex h-9 w-full items-center justify-end gap-2 px-3 text-sm font-semibold outline-none">
              {username}
              <ChevronDown className="size-4 rotate-180 transition-transform duration-300 motion-reduce:transition-none" aria-hidden="true" />
            </button>
            <div className="account-menu-body px-1.5 pb-1.5">
              {items.map(item => (
                <div key={item.label}>
                  {item.separated && <div className="mx-2 my-1 h-px bg-border" aria-hidden="true" />}
                  <Menu.Item onSelect={item.onSelect}
                    onPointerMove={follow(item.description)} onPointerLeave={() => setTip(null)}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none",
                      "transition-[background-color,padding] duration-150 data-[highlighted]:bg-accent data-[highlighted]:pl-3.5 motion-reduce:transition-none",
                    )}>
                    <item.icon className="size-4 shrink-0 text-muted-foreground" />
                    {item.label}
                    <span className="sr-only">: {item.description}</span>
                  </Menu.Item>
                </div>
              ))}
            </div>
          </div>
        </Menu.Content>
      </Menu.Portal>
      {/* Outside the menu, which is positioned with a transform that would carry a fixed element. */}
      {open && tip && typeof document !== "undefined" && createPortal(
        <div role="presentation" aria-hidden="true"
          className="account-menu-tip pointer-events-none fixed left-0 top-0 z-[60] rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-snug text-background shadow-lg"
          style={{
            maxWidth: TIP_WIDTH,
            transform: `translate3d(${flip ? tip.x - TIP_OFFSET : tip.x + TIP_OFFSET}px, ${tip.y + TIP_OFFSET}px, 0)${flip ? " translateX(-100%)" : ""}`,
          }}>
          {tip.text}
        </div>,
        document.body,
      )}
    </Menu.Root>
  );
}
