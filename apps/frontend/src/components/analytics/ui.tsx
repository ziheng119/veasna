"use client";

import { ComponentType, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, Info, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

export const panel = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";
export const enter = "animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both motion-reduce:animate-none";
export const fieldClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// "What is this?" help: hover or focus previews it, click/tap pins it open (for touch screens).
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  return <span className="relative inline-flex align-middle" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <button type="button" aria-label={`About ${label}`} aria-expanded={open} onClick={() => setPinned(value => !value)} onBlur={() => setPinned(false)}
      className={cn("grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90", pinned && "bg-muted text-foreground")}>
      <Info className="size-4" aria-hidden="true" />
    </button>
    {open && <span role="tooltip" className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-popover p-3 text-xs font-normal leading-5 text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none">
      {children}
    </span>}
  </span>;
}

interface SectionCardProps {
  id?: string; title: string; icon?: ComponentType<{ className?: string }>; description?: ReactNode;
  info?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; delay?: number; label?: string; tone?: string;
}

export function SectionCard({ id, title, icon: Icon, description, info, actions, children, className, delay = 0, label, tone = "bg-muted text-foreground/80" }: SectionCardProps) {
  return <section id={id} aria-label={label ?? title} style={{ animationDelay: `${delay}ms` }}
    className={cn(panel, enter, "scroll-mt-36 transition-shadow duration-300 hover:shadow-md", className)}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tone)} aria-hidden="true"><Icon className="size-4" /></span>}
        <div className="min-w-0">
          <div className="flex items-center gap-1"><h2 className="text-base font-semibold">{title}</h2>{info && <InfoTip label={title}>{info}</InfoTip>}</div>
          {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-end gap-3">{actions}</div>}
    </div>
    <div className="mt-5">{children}</div>
  </section>;
}

// Pill-style single choice; arrow keys move between options like a native radio group.
export function Segmented<T extends string>({ label, value, options, onChange, className }: {
  label: string; value: T; options: { id: T; label: string; title?: string }[]; onChange: (value: T) => void; className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };
  return <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1", className)}>
    {options.map((option, index) => {
      const selected = option.id === value;
      return <button key={option.id} ref={node => { refs.current[index] = node; }} type="button" role="radio" aria-checked={selected} title={option.title}
        tabIndex={selected ? 0 : -1} onClick={() => onChange(option.id)} onKeyDown={event => move(event, index)}
        className={cn("h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:transition-none",
          selected ? "bg-card text-blue-700 shadow-sm ring-1 ring-blue-200" : "text-muted-foreground hover:bg-card/60 hover:text-foreground")}>
        {option.label}
      </button>;
    })}
  </div>;
}

export function ExportMenu({ disabled, onCsv, onPrint }: { disabled: boolean; onCsv: () => void; onPrint: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  const item = "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none active:scale-[0.98]";
  const choose = (action: () => void) => () => { setOpen(false); action(); };

  return <div ref={root} className="relative">
    <button type="button" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(value => !value)}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 transition duration-200 hover:-translate-y-px hover:bg-emerald-700 hover:shadow-md active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">
      <Download className="size-4" aria-hidden="true" /><span>Export</span>
      <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
    </button>
    {open && <div role="menu" aria-label="Export options" className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-1.5 shadow-lg animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-150 motion-reduce:animate-none">
      <button type="button" role="menuitem" className={item} onClick={choose(onCsv)}>
        <FileSpreadsheet className="mt-0.5 size-4 text-emerald-700" aria-hidden="true" />
        <span><span className="block text-sm font-medium">Download spreadsheet (CSV)</span><span className="block text-xs text-muted-foreground">Every number on this page; opens in Excel</span></span>
      </button>
      <button type="button" role="menuitem" className={item} onClick={choose(onPrint)}>
        <Printer className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
        <span><span className="block text-sm font-medium">Print or save as PDF</span><span className="block text-xs text-muted-foreground">A printable copy of the charts</span></span>
      </button>
    </div>}
  </div>;
}
