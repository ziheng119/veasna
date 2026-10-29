"use client";

import { ReactNode, useEffect, useId, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SnellenInput from "@/components/shared/SnellenInput";
import formatDate from "@/helper/format_date";
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
}

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

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

  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b pb-2">
        <h4 className="text-lg font-semibold">{title}</h4>
        {canEdit && !editing && (record || canAdd) && (
          <Button variant="outline" size="sm" onClick={startEditing}>
            {record ? "Edit" : "Add"}
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {editing && editHint && <p className="text-sm text-muted-foreground">{editHint}</p>}
      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!values ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
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
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-foreground"
                checked={selected.includes(option.value)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))
                }
              />
              {option.label}
            </label>
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
