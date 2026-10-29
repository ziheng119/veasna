"use client";

import { ComponentType, ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, ChevronsDown, Lock, Plus, RotateCcw, ShieldAlert, X } from "lucide-react";
import { STATIONS, StationId, stationLabel } from "@/constants/stations";
import { Button } from "@/components/ui/button";
import { PRESS } from "@/lib/motion";
import { useFlipAnimation } from "@/lib/useFlipAnimation";
import { cn } from "@/lib/utils";

interface Props {
  route: StationId[];
  completed: StationId[];
  onChange: (route: StationId[]) => void;
  onTbHold: boolean;
  disabled?: boolean;
}

// Route rules, mirrored from apps/backend/utils/stationRoute.js:
// - the TB Tent always comes first and, while the patient is on TB hold, cannot be removed;
// - returning to a completed station makes it the next stop (still after the TB Tent);
// - a newly added station joins the end of the route.

/** Orders a single patient's remaining stops (not the patients within a station queue). */
export default function StationRouteEditor({ route, completed, onChange, onTbHold, disabled = false }: Props) {
  const listRef = useFlipAnimation<HTMLOListElement>(route);

  const move = (index: number, target: number) => {
    const next = [...route];
    const [station] = next.splice(index, 1);
    next.splice(target, 0, station);
    onChange(next);
  };
  const add = (station: StationId) => {
    if (station === "tb") onChange([station, ...route]);
    else if (completed.includes(station)) {
      const index = route[0] === "tb" ? 1 : 0;
      onChange([...route.slice(0, index), station, ...route.slice(index)]);
    } else onChange([...route, station]);
  };

  const done = completed.filter((station) => !route.includes(station));
  const available = STATIONS.filter((station) => !route.includes(station.id));

  return (
    <div className="space-y-5">
      {done.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="mr-1 font-medium">Done</span>
          {done.map((station) => (
            <span key={station} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <Check className="size-3 text-emerald-600" aria-hidden="true" />
              {stationLabel(station)}
            </span>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Remaining stops</h3>
        {route.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No stops left. Add one below, or discharge the patient instead.
          </p>
        ) : (
          <ol ref={listRef} aria-label="Remaining station route" className="space-y-2">
            {route.map((station, index) => {
              const label = stationLabel(station);
              const isTb = station === "tb";
              const isLast = index === route.length - 1;
              return (
                <li
                  key={station}
                  data-flip-key={station}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border border-border bg-card p-2 pl-3 transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 hover:shadow-sm",
                    index === 0 && "border-primary/30 bg-primary/[0.03]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-300",
                      index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{label}</span>
                    {index === 0 && <Tag tone="primary">Next</Tag>}
                    {completed.includes(station) && <Tag tone="amber" icon={RotateCcw}>Revisit</Tag>}
                    {isTb && onTbHold && <Tag tone="red" icon={Lock}>TB hold</Tag>}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <RowAction
                      label={`Move ${label} up`}
                      icon={ArrowUp}
                      disabled={disabled || index === 0 || route[index - 1] === "tb"}
                      onClick={() => move(index, index - 1)}
                    />
                    <RowAction
                      label={`Move ${label} down`}
                      icon={ArrowDown}
                      disabled={disabled || isTb || isLast}
                      onClick={() => move(index, index + 1)}
                    />
                    <RowAction
                      label={`Move ${label} to the end`}
                      icon={ChevronsDown}
                      text="Later"
                      disabled={disabled || isTb || isLast}
                      onClick={() => move(index, route.length - 1)}
                    />
                    <RowAction
                      label={`Remove ${label}`}
                      icon={X}
                      tone="danger"
                      disabled={disabled || (isTb && onTbHold)}
                      onClick={() => onChange(route.filter((s) => s !== station))}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {available.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Add a stop</h3>
          <div className="flex flex-wrap gap-2" aria-label="Add or revisit stations">
            {available.map((station) => {
              const revisit = completed.includes(station.id);
              const Icon = revisit ? RotateCcw : Plus;
              const action = `${revisit ? "Return to" : "Add"} ${station.label}`;
              return (
                <Button
                  key={station.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={action}
                  title={station.id === "tb" ? "Goes first. Holds the patient until a TB doctor clears them." : undefined}
                  disabled={disabled}
                  onClick={() => add(station.id)}
                  className={cn(
                    "group h-8 gap-1.5 rounded-full px-3 transition duration-200 hover:-translate-y-px hover:shadow-sm",
                    "animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none motion-reduce:transform-none",
                    PRESS,
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 transition-transform duration-300 motion-reduce:transform-none",
                      revisit ? "group-hover:-rotate-90" : "group-hover:rotate-90",
                    )}
                  />
                  {revisit ? `Return to ${station.label}` : station.label}
                </Button>
              );
            })}
          </div>
        </section>
      )}

      {onTbHold ? (
        <Hint>On TB hold: stays at the TB Tent until a TB doctor clears them.</Hint>
      ) : (
        available.some((station) => station.id === "tb") && <Hint>Suspect TB? Add TB Tent. It goes first and holds the patient.</Hint>
      )}
    </div>
  );
}

const TAG_TONES = {
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
} as const;

function Tag({ tone, icon: Icon, children }: { tone: keyof typeof TAG_TONES; icon?: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none", TAG_TONES[tone])}>
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <ShieldAlert className="size-3.5 shrink-0 text-red-600" aria-hidden="true" />
      {children}
    </p>
  );
}

// Icon button for a route row. The label doubles as its tooltip and accessible name.
function RowAction({
  label, icon: Icon, text, tone, disabled, onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  text?: string;
  tone?: "danger";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 gap-1 rounded-full text-muted-foreground transition duration-200 disabled:opacity-25",
        text ? "px-2.5" : "w-8 px-0",
        tone === "danger" ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground",
        PRESS,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {text && <span className="text-xs">{text}</span>}
    </Button>
  );
}
