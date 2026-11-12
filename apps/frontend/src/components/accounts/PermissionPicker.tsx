"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PERMISSIONS, PERMISSIONS, Permission, permissionLabel, togglePermission } from "@/lib/permissions";

const GROUPS = ["Patients", "Extras"] as const;

interface Props {
  value: Permission[];
  onChange: (value: Permission[]) => void;
  disabled?: boolean;
  // Prefix for element ids, when more than one picker is on the page.
  id: string;
}

/**
 * What a non-admin account may do, as a row of toggles: compact enough to sit under the username
 * and password. Pointing at or focusing a toggle says what it allows. Ticking one that needs
 * another ticks that too (e.g. "Edit past visits" needs "See past patients"), and says so.
 */
export default function PermissionPicker({ value, onChange, disabled = false, id }: Props) {
  // The toggle pointed at or focused, whose description shows below; null shows a hint.
  const [described, setDescribed] = useState<Permission | null>(null);
  // What else changed with the last toggle, e.g. "Also ticked: See past patients".
  const [note, setNote] = useState("");

  const toggle = (key: Permission) => {
    const on = !value.includes(key);
    const next = togglePermission(value, key, on);
    const also = (on ? next.filter(item => !value.includes(item)) : value.filter(item => !next.includes(item)))
      .filter(item => item !== key).map(permissionLabel);
    setNote(also.length ? `${on ? "Also ticked" : "Also unticked"}: ${also.join(", ")}.` : "");
    onChange(next);
  };
  const isDefault = value.join() === DEFAULT_PERMISSIONS.join();
  const description = described && PERMISSIONS.find(permission => permission.key === described)?.description;

  return (
    <div className="space-y-2" onPointerLeave={() => setDescribed(null)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {GROUPS.map(group => (
          <div key={group} role="group" aria-label={group} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</span>
            {PERMISSIONS.filter(permission => permission.group === group).map(permission => {
              const on = value.includes(permission.key);
              return (
                <button key={permission.key} type="button" role="checkbox" aria-checked={on} disabled={disabled}
                  aria-describedby={`${id}-${permission.key}`}
                  onClick={() => toggle(permission.key)}
                  onPointerEnter={() => setDescribed(permission.key)} onFocus={() => setDescribed(permission.key)}
                  onBlur={() => setDescribed(null)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none",
                    "transition-[background-color,border-color,color,transform] duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    on
                      ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}>
                  <Check aria-hidden="true" className={cn("size-3.5 transition-[opacity,width] duration-150", on ? "opacity-100" : "w-0 opacity-0")} />
                  {permission.label}
                  <span id={`${id}-${permission.key}`} className="sr-only">{permission.description}</span>
                </button>
              );
            })}
          </div>
        ))}
        {!isDefault && (
          <button type="button" disabled={disabled} onClick={() => { setNote(""); onChange([...DEFAULT_PERMISSIONS]); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            <RotateCcw className="size-3" aria-hidden="true" /> Defaults
          </button>
        )}
      </div>
      {/* One line, so the page doesn't jump: what the pointed-at toggle allows, or what changed. */}
      <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
        {description ?? (note || (value.length === 0
          ? "Nothing ticked: the account can only view the station queues."
          : "Point at a permission to see what it allows."))}
      </p>
    </div>
  );
}
