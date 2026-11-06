"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { resetFormOptions, saveFormOptions } from "@/lib/api/formOptions/formOptions";
import { useFormOptionsStore } from "@/stores/useFormOptionsStore";
import type { FormOption, FormOptionKey } from "@/lib/types/formOptions";
import { normalizeSnellen } from "@/lib/snellen";

interface Props {
  listKey: FormOptionKey;
  title: string;
  description: string;
  // "value": forms save the name itself. "id": forms save a fixed id, so a renamed choice still
  // matches the records saved with it.
  kind: "value" | "id";
  placeholder: string;
  anchor?: string;
}

// A stable id for a new choice in an "id" list, from its name (e.g. "Kidney disease" -> kidney_disease).
export function newOptionId(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "choice";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}_${n}`;
  return id;
}

// The problem with a draft list, or null when it can be saved. Mirrors apps/backend/utils/formOptions.js.
export function draftError(listKey: FormOptionKey, items: FormOption[]): string | null {
  if (items.length === 0) return "Keep at least one choice.";
  if (items.some(item => !item.label.trim())) return "Every choice needs a name.";
  if (listKey === "snellen") {
    const bad = items.find(item => !normalizeSnellen(item.label));
    if (bad) return `"${bad.label}" is not a Snellen fraction such as 6/6 or 6/9.`;
  }
  const names = items.map(item => item.label.trim().toLowerCase());
  if (new Set(names).size !== names.length) return "Each choice must appear only once.";
  return null;
}

/** Edits one list of form choices: rename, reorder, add, remove, then save for every device. */
export default function OptionListEditor({ listKey, title, description, kind, placeholder, anchor }: Props) {
  const list = useFormOptionsStore(state => state.lists[listKey]);
  const setList = useFormOptionsStore(state => state.setList);
  const [draft, setDraft] = useState<FormOption[]>(list.items);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Show the saved list whenever it changes (loaded, or saved here or on another device).
  useEffect(() => setDraft(list.items), [list.items]);

  const changed = JSON.stringify(draft) !== JSON.stringify(list.items);
  const error = draftError(listKey, draft);

  const update = (index: number, label: string) =>
    setDraft(items => items.map((item, i) => i !== index ? item : kind === "value" ? { id: label, label } : { ...item, label }));
  const move = (index: number, by: number) => setDraft(items => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    return next;
  });
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setDraft(items => [...items, { id: kind === "value" ? label : newOptionId(label, items.map(item => item.id)), label }]);
    setNewLabel("");
  };

  const save = async () => {
    if (error) return;
    setBusy(true);
    try {
      setList(listKey, await saveFormOptions(listKey, draft.map(item => ({ ...item, label: item.label.trim() }))));
      toast.success(`${title} saved. Forms on every device use the new choices.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save the choices.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      setList(listKey, await resetFormOptions(listKey));
      toast.success(`${title}: built-in choices restored.`);
      setConfirmReset(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to restore the choices.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id={anchor} className="scroll-mt-24 border-border">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <p className="text-xs text-muted-foreground">
          {list.customized
            ? `Changed${list.last_updated_by ? ` by ${list.last_updated_by}` : ""}${list.last_updated_at ? ` on ${new Date(list.last_updated_at).toLocaleString()}` : ""}.`
            : "Built-in choices."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-2">
          {draft.map((item, index) => (
            <li key={`${item.id}-${index}`} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <Input aria-label={`Choice ${index + 1}`} value={item.label} maxLength={100}
                onChange={event => update(index, event.target.value)} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Move ${item.label} up`} disabled={index === 0}
                onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Move ${item.label} down`} disabled={index === draft.length - 1}
                onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${item.label}`}
                onClick={() => setDraft(items => items.filter((_, i) => i !== index))}><Trash2 className="size-4 text-destructive" /></Button>
            </li>
          ))}
        </ol>
        <form className="flex items-center gap-2 pl-8" onSubmit={event => { event.preventDefault(); add(); }}>
          <Input aria-label={`New choice for ${title}`} placeholder={placeholder} value={newLabel} maxLength={100}
            onChange={event => setNewLabel(event.target.value)} />
          <Button type="submit" variant="outline" disabled={!newLabel.trim()}><Plus className="size-4" /> Add</Button>
        </form>
        {changed && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">Records saved earlier keep the choices they were saved with.</p>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          {list.customized && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmReset(true)}>
              <RotateCcw className="size-4" /> Restore built-in choices
            </Button>
          )}
          <Button type="button" variant="outline" disabled={!changed || busy} onClick={() => setDraft(list.items)}>Discard changes</Button>
          <Button type="button" disabled={!changed || !!error || busy} onClick={save}>{busy ? "Saving..." : "Save"}</Button>
        </div>
      </CardContent>
      <ConfirmDialog open={confirmReset} busy={busy} title={`Restore ${title.toLowerCase()}?`}
        description="The list goes back to the choices Veasna came with. Records saved earlier are not changed."
        confirmLabel="Restore" onConfirm={reset} onCancel={() => setConfirmReset(false)} />
    </Card>
  );
}
