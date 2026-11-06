"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import SortableList, { moveItem } from "@/components/shared/SortableList";
import { useConfirm } from "@/hooks/useConfirm";
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

/** Edits one list of form choices: rename, drag to reorder, add, remove, then save for every device. */
export default function OptionListEditor({ listKey, title, description, kind, placeholder, anchor }: Props) {
  const list = useFormOptionsStore(state => state.lists[listKey]);
  const setList = useFormOptionsStore(state => state.setList);
  const [draft, setDraft] = useState<FormOption[]>(list.items);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { confirm, dialog } = useConfirm();
  // Draft rows need keys that survive renaming and reordering.
  const [rowKeys, setRowKeys] = useState<string[]>(() => list.items.map((_, i) => `row-${i}`));
  const nextKey = useRef(list.items.length);

  // Show the saved list whenever it changes (loaded, or saved here or on another device).
  const resetDraft = (items: FormOption[]) => {
    setDraft(items);
    setRowKeys(items.map(() => `row-${nextKey.current++}`));
  };
  useEffect(() => resetDraft(list.items), [list.items]);

  const changed = JSON.stringify(draft) !== JSON.stringify(list.items);
  const error = draftError(listKey, draft);

  const update = (index: number, label: string) =>
    setDraft(items => items.map((item, i) => i !== index ? item : kind === "value" ? { id: label, label } : { ...item, label }));
  const reorder = (from: number, to: number) => {
    setDraft(items => moveItem(items, from, to));
    setRowKeys(keys => moveItem(keys, from, to));
  };
  const remove = async (index: number) => {
    const label = draft[index]?.label || "this choice";
    if (!await confirm({
      title: `Remove "${label}"?`,
      description: "It will no longer be offered in the form once you save. Records saved with it keep it.",
      confirmLabel: "Remove choice",
    })) return;
    setDraft(items => items.filter((_, i) => i !== index));
    setRowKeys(keys => keys.filter((_, i) => i !== index));
  };
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setDraft(items => [...items, { id: kind === "value" ? label : newOptionId(label, items.map(item => item.id)), label }]);
    setRowKeys(keys => [...keys, `row-${nextKey.current++}`]);
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
        <SortableList
          aria-label={title}
          items={draft.map((item, index) => ({ item, key: rowKeys[index] ?? `row-x${index}` }))}
          getKey={(row) => row.key}
          getLabel={(row) => row.item.label || "choice"}
          onReorder={reorder}
          disabled={busy}
          itemClassName="flex items-center gap-2 rounded-lg bg-card"
          renderItem={({ item }, index, handle) => (
            <>
              {handle}
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <Input aria-label={`Choice ${index + 1}`} value={item.label} maxLength={100}
                onChange={event => update(index, event.target.value)} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${item.label}`}
                className="hover:bg-destructive/10" onClick={() => remove(index)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </>
          )}
        />
        <form className="flex items-center gap-2 pl-[3.75rem]" onSubmit={event => { event.preventDefault(); add(); }}>
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
          <Button type="button" variant="outline" disabled={!changed || busy} onClick={() => resetDraft(list.items)}>Discard changes</Button>
          <Button type="button" disabled={!changed || !!error || busy} onClick={save}>{busy ? "Saving..." : "Save"}</Button>
        </div>
      </CardContent>
      <ConfirmDialog open={confirmReset} busy={busy} title={`Restore ${title.toLowerCase()}?`}
        description="The list goes back to the choices Veasna came with. Records saved earlier are not changed."
        confirmLabel="Restore" onConfirm={reset} onCancel={() => setConfirmReset(false)} />
      {dialog}
    </Card>
  );
}

