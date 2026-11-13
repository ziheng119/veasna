"use client";

// "Group families" for any queue (Today's Queue on Registration, and each station's queue): the
// switch and its panel, the dotted family boxes, and the drag-and-drop draft behind them. While the
// switch is on, cards are dragged onto each other or out of their box (src/lib/familyGrouping.ts);
// turning it off saves.
import { ReactNode, RefObject, useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import FamilyBadge from "./FamilyBadge";
import { QueuedPatient } from "@/lib/types/patient";
import { cn } from "@/lib/utils";
import { familyTone } from "@/lib/family";
import {
  EMPTY_DRAFT, GroupingDraft, MAX_GROUP, draftChanges, dropOnPatient, dropOutside, previewFamilies,
} from "@/lib/familyGrouping";
import { groupFamily, leaveFamily } from "@/lib/api/family";
import { EMPTY, STAY, useCardDrag } from "@/hooks/useCardDrag";
import { useFlip } from "@/hooks/useFlip";

// Consecutive cards of one family (at least two shown) share a dotted box; anyone else stands alone.
export type FamilyBlock = { family: string | null; patients: QueuedPatient[] };
export function toBlocks(patients: QueuedPatient[]): FamilyBlock[] {
  const blocks: FamilyBlock[] = [];
  for (const patient of patients) {
    const last = blocks[blocks.length - 1];
    if (patient.family && last?.family === patient.family) last.patients.push(patient);
    else blocks.push({ family: patient.family ?? null, patients: [patient] });
  }
  return blocks.flatMap((block) => (block.family && block.patients.length < 2
    ? [{ family: null, patients: block.patients }]
    : [block]));
}

// The draft, the drag and saving. `patients` is the queue as loaded; `shown` is it as it will be saved
// (each drop shows at once), for the list to sort and box.
export function useFamilyGrouping(
  patients: QueuedPatient[], token: string | undefined, onFamilyChanged?: () => void | Promise<unknown>,
) {
  const [grouping, setGrouping] = useState(false);
  const [draft, setDraft] = useState<GroupingDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const patientsRef = useRef(patients);
  patientsRef.current = patients;

  const handleDrop = useCallback((draggedId: number, targetId: number | null) => {
    const dragged = patientsRef.current.find((patient) => patient.patient_id === draggedId);
    // Dropped outside the list, or back in its own box: nothing changes.
    if (!dragged || targetId === null || targetId === STAY) return;
    if (targetId === EMPTY) {
      setDraft((current) => dropOutside(current, dragged));
      return;
    }
    const target = patientsRef.current.find((patient) => patient.patient_id === targetId);
    if (target) setDraft((current) => dropOnPatient(current, dragged, target, patientsRef.current));
  }, []);
  const drag = useCardDrag(handleDrop);

  const cancel = () => {
    setGrouping(false);
    setDraft(EMPTY_DRAFT);
  };

  async function toggle(on: boolean) {
    if (on) {
      setDraft(EMPTY_DRAFT);
      setGrouping(true);
      return;
    }
    const { leave, group } = draftChanges(draft);
    if (!leave.length && !group) {
      if (draft.selected.length === 1) toast("Pick at least two patients to make a family.");
      cancel();
      return;
    }
    if (group && group.length > MAX_GROUP) {
      toast.error(`A family can be grouped ${MAX_GROUP} patients at a time.`);
      return;
    }
    if (!token) return;
    setSaving(true);
    try {
      for (const id of leave) await leaveFamily(id, token);
      const family = group ? (await groupFamily(group, token)).family : null;
      toast.success(family
        ? `Family ${family}: ${group!.length} patients grouped.`
        : `${leave.length === 1 ? "1 patient" : `${leave.length} patients`} taken out of their family.`);
      // The preview stays until the saved queue is loaded, so the cards don't jump back in between;
      // then they glide into their saved order.
      await onFamilyChanged?.();
      cancel();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update the family");
      await onFamilyChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return {
    grouping, saving, draft, toggle, cancel, ...drag,
    shown: grouping ? previewFamilies(patients, draft) : patients,
  };
}

// A switch (no Radix Switch in this app): role="switch" with aria-checked.
function GroupSwitch({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="group inline-flex items-center gap-2 rounded-md text-sm font-medium text-foreground disabled:opacity-50"
    >
      <span className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
        on ? "bg-primary" : "bg-muted-foreground/30",
      )}>
        <span className={cn(
          "absolute left-0.5 size-4 rounded-full bg-background shadow transition-transform duration-200 motion-reduce:transition-none",
          on && "translate-x-4",
        )} />
      </span>
      <Users className="size-4 text-muted-foreground" aria-hidden="true" />
      Group families
    </button>
  );
}

// The switch, growing into a highlighted panel while on and shrinking back when off. The height is
// animated (grid rows 0fr to 1fr), so the search box and the list below glide with it.
export function GroupFamiliesPanel({ state, disabled }: {
  state: ReturnType<typeof useFamilyGrouping>; disabled?: boolean;
}) {
  const { grouping, saving, draft } = state;
  const picked = draft.selected.length;
  return (
    <div data-tour="home-group-families" className={cn(
      "rounded-lg border transition-[padding,background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
      grouping ? "border-primary/40 bg-primary/5 p-2.5 shadow-sm" : "border-transparent p-0",
    )}>
      <div className="flex items-center justify-between gap-2">
        <GroupSwitch on={grouping} disabled={saving || disabled} onChange={(on) => void state.toggle(on)} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          tabIndex={grouping ? undefined : -1}
          aria-hidden={!grouping || undefined}
          className={cn(
            "h-7 px-2 text-xs transition-[opacity,scale] duration-200 motion-reduce:transition-none",
            grouping ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-90",
          )}
          disabled={saving || !grouping}
          onClick={state.cancel}
        >
          Cancel
        </Button>
      </div>
      <Collapse open={grouping}>
        <p role="status" aria-hidden={!grouping || undefined} className="pt-2 text-xs text-muted-foreground">
          {saving
            ? "Saving…"
            : picked >= 2
              ? `${picked} picked. Turn the switch off to group them as one family.`
              : "Hold and drag a patient onto another patient or a family's box to group them; drag one out of its box onto empty space to take them out. Turn the switch off to save."}
        </p>
      </Collapse>
    </div>
  );
}

// Shows or hides its content by animating its height (grid rows 0fr to 1fr), so what is below glides.
// Hidden, it can't be reached (inert). Spans, so it also fits inside a button.
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      inert={!open || undefined}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <span className="block min-h-0 overflow-hidden">{children}</span>
    </span>
  );
}

// The queue's cards, a family's in one dotted box: lightly marked normally, strongly while grouping
// so the boxes read as drop targets. Cards glide to their new places when the order or families change.
export function FamilyBlocks({ blocks, state, listRef, renderCard, className }: {
  blocks: FamilyBlock[];
  state: ReturnType<typeof useFamilyGrouping>;
  listRef: RefObject<HTMLDivElement | null>;
  renderCard: (patient: QueuedPatient, inFamilyBox: boolean, isNew: boolean) => ReactNode;
  className?: string;
}) {
  const { grouping, overId, draggingId } = state;
  useFlip(listRef, blocks
    .map((block) => `${block.family ?? ""}:${block.patients.map((patient) => patient.visit_id).join(",")}`)
    .join("|"));
  // Cards already shown don't fade in again when they move into (or out of) a family's box.
  const shown = useRef(new Set<number>());
  const card = (patient: QueuedPatient, inBox: boolean) => {
    const isNew = !shown.current.has(patient.visit_id);
    shown.current.add(patient.visit_id);
    return renderCard(patient, inBox, isNew);
  };
  return (
    <div ref={listRef} data-drop-list={grouping || undefined} className={className}>
      {blocks.map((block) => block.family ? (
        <div
          key={`family-${block.family}`}
          data-family-box={block.family}
          data-flip-id={`family-${block.family}`}
          data-drop-box={grouping ? block.family : undefined}
          className={cn(
            "relative space-y-2 rounded-xl border-2 border-dashed p-2 pt-3.5",
            // Only a box of cards new to the queue fades in; cards already shown glide into it.
            block.patients.every((patient) => !shown.current.has(patient.visit_id))
              && "animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none",
            "transition-[background-color,border-color,box-shadow,scale] duration-200 motion-reduce:transition-none",
            grouping ? familyTone(block.family).boxStrong : familyTone(block.family).box,
            grouping && block.patients.some((patient) => patient.patient_id === overId && draggingId !== overId)
              && "scale-[1.02] shadow-md ring-2 ring-primary/60",
          )}
        >
          <FamilyBadge family={block.family} className="absolute -top-2.5 left-3 shadow-sm" />
          {block.patients.map((patient) => card(patient, true))}
        </div>
      ) : (
        card(block.patients[0], false)
      ))}
    </div>
  );
}

// Classes for a queue card while grouping: draggable, lifted when it is the drop target, and left in
// place as a faint outline while a floating copy follows the pointer (useCardDrag).
export function groupingCardClass(state: ReturnType<typeof useFamilyGrouping>, id: number, inFamilyBox: boolean) {
  const dragging = state.draggingId === id;
  return cn(
    "cursor-grab select-none touch-none transition-[scale,box-shadow,background-color,border-color,opacity] duration-150 motion-reduce:transition-none",
    !inFamilyBox && state.overId === id && !dragging && "scale-[1.03] ring-2 ring-primary/60 shadow-md",
    dragging && "border-dashed opacity-40 shadow-none",
  );
}
