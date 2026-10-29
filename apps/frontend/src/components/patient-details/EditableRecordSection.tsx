"use client";

import { ReactNode, useEffect, useId, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import GlassButton from "@/components/shared/GlassButton";
import SnellenInput from "@/components/shared/SnellenInput";
import formatDate from "@/helper/format_date";
import { ENTER_FAST, PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type FieldOption = { readonly value: string; readonly label: string };

type BaseField<D> = {
  key: keyof D & string;
  label: string;
  // Span both columns of the section grid.
  wide?: boolean;
};

/**
 * One editable field of a record. `kind` picks the input in edit mode and the formatting in
 * view mode; "custom" renders both itself (e.g. the physiotherapy body chart).
 */
export type FieldSpec<D> = BaseField<D> &
  (
    | { kind: "text" | "textarea" | "date" }
    | { kind: "number"; step?: string }
    | { kind: "boolean" }
    | { kind: "snellen" }
    | { kind: "select"; options: readonly FieldOption[]; allowBlank?: string }
    | { kind: "checkboxes"; options: readonly FieldOption[] }
    | {
        kind: "custom";
        render: (value: D[keyof D], onChange: (value: D[keyof D]) => void, editing: boolean) => ReactNode;
      }
  );

interface Props<D extends Record<string, unknown>> {
  title: string;
  // Saved values in draft shape; null when the record was never made for this visit.
  record: D | null;
  fields: FieldSpec<D>[];
  canEdit: boolean;
  onSave: (draft: D) => Promise<void>;
  // Starting values when adding a missing record. Omit to only allow editing existing records.
  emptyDraft?: D;
  // Returns a user-facing message when the draft cannot be saved.
  validate?: (draft: D) => string | null;
  // Recomputes derived values (e.g. BMI) after each change.
  derive?: (draft: D) => D;
  // Shown under the title while editing, for rules that are not obvious from the inputs.
  editHint?: ReactNode;
  // Facts shown in both modes that are never edited here (e.g. generated IDs).
  readOnlyItems?: { label: string; value: ReactNode }[];
  emptyMessage?: string;
  // Draw the section as its own card. Turn off when it already sits inside a Card.
  framed?: boolean;
}

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** View/edit card for one record of a visit or patient. Admins edit and save it on its own. */
export default function EditableRecordSection<D extends Record<string, unknown>>({
  title,
  record,
  fields,
  canEdit,
  onSave,
  emptyDraft,
  validate,
  derive = (draft) => draft,
  editHint,
  readOnlyItems = [],
  emptyMessage = "Not recorded for this visit.",
  framed = true,
}: Props<D>) {
  const idPrefix = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<D | null>(record);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow fresh data from the server, but never discard an edit in progress.
  useEffect(() => {
    if (!editing) setDraft(record);
  }, [record, editing]);

  const canAdd = !record && emptyDraft !== undefined;
  // Compared as JSON: drafts are plain values, and this only runs while editing.
  const isDirty = useMemo(
    () => editing && JSON.stringify(draft) !== JSON.stringify(record ?? emptyDraft ?? null),
    [editing, draft, record, emptyDraft],
  );

  const startEditing = () => {
    setDraft(record ?? emptyDraft ?? null);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(record);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (!draft) return;
    const problem = validate?.(draft) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
      toast.success(`${title} saved`);
    } catch (err) {
      console.error(`Saving ${title} failed:`, err);
      setError(err instanceof Error ? err.message : `Unable to save ${title.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof D, value: unknown) =>
    setDraft((previous) => (previous ? derive({ ...previous, [key]: value }) : previous));

  const values = editing ? draft : record;
  const StartIcon = record ? Pencil : Plus;

  return (
    <section
      aria-label={title}
      className={cn(
        "space-y-4 transition-[box-shadow,border-color,background-color] duration-300 motion-reduce:transition-none",
        framed && "rounded-xl border border-border bg-card p-4 hover:shadow-sm",
        framed && editing && "border-primary/40 bg-primary/[0.02] shadow-md ring-2 ring-primary/15 hover:shadow-md",
      )}
    >
      <div className="flex min-h-9 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="truncate text-lg font-semibold">{title}</h4>
          {editing && (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary", ENTER_FAST)}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
              Editing
            </span>
          )}
        </div>

        {canEdit && !editing && (record || canAdd) && (
          <GlassButton
            size="sm"
            onClick={startEditing}
            aria-label={`${record ? "Edit" : "Add"} ${title}`}
            className={cn("group h-8 gap-1.5 px-3 hover:-translate-y-px", ENTER_FAST)}
          >
            <StartIcon
              className={cn(
                "size-3.5 transition-transform duration-300 motion-reduce:transform-none",
                record ? "group-hover:-rotate-12 group-hover:scale-110" : "group-hover:rotate-90",
              )}
            />
            {record ? "Edit" : "Add"}
          </GlassButton>
        )}

        {editing && (
          <div className={cn("flex items-center gap-2", ENTER_FAST)}>
            {isDirty && !saving && <span className="hidden text-xs text-muted-foreground sm:inline">Unsaved changes</span>}
            <Button
              variant="ghost"
              size="sm"
              onClick={cancel}
              disabled={saving}
              className={cn("group h-8 gap-1.5 rounded-full px-3 hover:bg-muted", PRESS)}
            >
              <X className="size-3.5 transition-transform duration-300 group-hover:rotate-90 motion-reduce:transform-none" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving || !isDirty}
              title={isDirty ? undefined : "No changes to save"}
              className={cn(
                "group h-8 gap-1.5 rounded-full px-4 shadow-sm transition duration-200 hover:-translate-y-px hover:shadow-md motion-reduce:transition-none",
                PRESS,
              )}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Check className="size-3.5 transition-transform duration-300 group-hover:scale-125 motion-reduce:transform-none" />
              )}
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {editing && editHint && <p className={cn("text-sm text-muted-foreground", ENTER_FAST)}>{editHint}</p>}
      {error && (
        <p
          role="alert"
          className={cn("rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive", ENTER_FAST)}
        >
          {error}
        </p>
      )}

      {!values ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        // Keyed on the mode so switching between view and edit replays the entrance.
        <div key={editing ? "edit" : "view"} className={cn("grid grid-cols-2 gap-4", ENTER_FAST)}>
          {readOnlyItems.map((item) => (
            <div key={item.label}>
              <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-foreground">{item.value}</p>
            </div>
          ))}
          {fields.map((field) => {
            const id = `${idPrefix}-${field.key}`;
            const value = values[field.key];
            return (
              <div key={field.key} className={cn(field.wide && "col-span-2")}>
                <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
                  {field.label}
                </label>
                <div className="mt-1">
                  {editing
                    ? renderInput(field, id, value, (next) => setField(field.key, next))
                    : renderValue(field, value)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Bordered checkbox option that highlights when ticked, matching the referral form. */
export function CheckboxTile({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors duration-200 motion-reduce:transition-none",
        checked ? "border-foreground/25 bg-muted/60" : "border-border hover:bg-muted/30",
        PRESS,
      )}
    >
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-foreground"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function renderInput<D>(field: FieldSpec<D>, id: string, value: unknown, onChange: (value: unknown) => void) {
  switch (field.kind) {
    case "text":
    case "date":
      return <Input id={id} type={field.kind} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={field.step ?? "any"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return <Textarea id={id} rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "boolean":
      return (
        <select id={id} className={SELECT_CLASS} value={value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "yes")}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    case "select":
      return (
        <select id={id} className={SELECT_CLASS} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          {field.allowBlank !== undefined && <option value="">{field.allowBlank}</option>}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "snellen":
      return <SnellenInput value={(value as string) ?? ""} onChange={onChange} />;
    case "checkboxes": {
      const selected = (value as string[] | null) ?? [];
      return (
        <div id={id} role="group" className="grid gap-2 sm:grid-cols-2">
          {field.options.map((option) => (
            <CheckboxTile
              key={option.value}
              label={option.label}
              checked={selected.includes(option.value)}
              onChange={(checked) =>
                onChange(checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))
              }
            />
          ))}
        </div>
      );
    }
    case "custom":
      return field.render(value as never, onChange as never, true);
  }
}

function renderValue<D>(field: FieldSpec<D>, value: unknown): ReactNode {
  const text = (content: ReactNode) => <p className="whitespace-pre-wrap text-foreground">{content}</p>;
  const isBlank = value === null || value === undefined || value === "";
  switch (field.kind) {
    case "boolean":
      return text(value ? "Yes" : "No");
    case "date":
      return text(isBlank ? "N/A" : formatDate(value as string));
    case "select":
      return text(isBlank ? field.allowBlank ?? "N/A" : field.options.find((o) => o.value === value)?.label ?? String(value));
    case "checkboxes": {
      const labels = ((value as string[] | null) ?? []).map((v) => field.options.find((o) => o.value === v)?.label ?? v);
      return text(labels.length ? labels.join(", ") : "None");
    }
    case "custom":
      return field.render(value as never, () => {}, false);
    default:
      return text(isBlank ? "N/A" : String(value));
  }
}
