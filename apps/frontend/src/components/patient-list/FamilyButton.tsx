"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, Search, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FamilyBadge from "@/components/shared/FamilyBadge";
import { joinFamily, leaveFamily } from "@/lib/api/family";
import { familyTone } from "@/lib/family";
import { ENTER_FAST, POP } from "@/lib/motion";
import { PatientInfo } from "@/lib/types/patient";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";
import { useConfirm } from "@/hooks/useConfirm";

const MAX_RESULTS = 8;

interface Props {
  patient: PatientInfo;
  // Everyone on the Patient List, to search for the family member to join.
  patients: PatientInfo[];
  // Tells the row the pop-up is open, so the list can show which patient it is about.
  onOpenChange?: (open: boolean) => void;
  // Called after a family changed, to reload the list.
  onChanged?: () => void | Promise<unknown>;
}

// A search result: an existing family (picked by any member), or a patient not in a family.
type Target = { key: string; family: string | null; members: PatientInfo[] };

const nameOf = (patient: PatientInfo) => patient.english_name || patient.khmer_name || "Unknown name";
const matches = (patient: PatientInfo, text: string) =>
  [patient.english_name, patient.khmer_name, patient.phone_number].some((value) => value?.toLowerCase().includes(text));

/**
 * "Add to family" on a Patient List row: a pop-up to search the Patient List for someone this
 * patient came with, and put this patient in that person's family (or start a family of the two).
 * The patient can also be taken out of their family. Queue numbers don't change; family members
 * move between stations together.
 */
export default function FamilyButton({ patient, patients, onOpenChange, onChanged }: Props) {
  const token = useUserStore((state) => state.user?.token);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const name = nameOf(patient);
  const { confirm: confirmAction, dialog } = useConfirm();

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) { setQuery(""); setSelected(null); }
  };

  const families = useMemo(() => {
    const byLetter = new Map<string, PatientInfo[]>();
    for (const other of patients) {
      if (other.family) byLetter.set(other.family, [...(byLetter.get(other.family) ?? []), other]);
    }
    return byLetter;
  }, [patients]);
  const myFamily = patient.family ? (families.get(patient.family) ?? []).filter((other) => other.id !== patient.id) : [];
  const text = query.trim().toLowerCase();

  // Matching patients, with each family shown once as a whole. Nothing until something is typed.
  const targets = useMemo<Target[]>(() => {
    if (!text) return [];
    const found = new Map<string, Target>();
    for (const other of patients) {
      if (other.id === patient.id || (patient.family && other.family === patient.family)) continue;
      if (other.family?.toLowerCase() !== text && !matches(other, text)) continue;
      const key = other.family ? `family-${other.family}` : `patient-${other.id}`;
      if (!found.has(key)) {
        found.set(key, { key, family: other.family ?? null, members: other.family ? families.get(other.family) ?? [other] : [other] });
      }
      if (found.size >= MAX_RESULTS) break;
    }
    return Array.from(found.values());
  }, [patients, families, patient.id, patient.family, text]);

  const run = async (action: () => Promise<string>) => {
    if (!token) return;
    setBusy(true);
    try {
      const message = await action();
      toast.success(message, { duration: 5000 });
      setOpenState(false);
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the family");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => selected && run(async () => {
    const result = await joinFamily(patient.id, selected.members[0].id, token!);
    return `${name} is now in family ${result.family} with ${selected.members.map(nameOf).join(", ")}.`;
  });

  const leave = async () => {
    if (!await confirmAction({
      title: `Remove ${name} from family ${patient.family}?`,
      description: "They keep their queue number but will no longer move between stations with the family.",
      confirmLabel: "Remove from family",
    })) return;
    await leaveNow();
  };
  const leaveNow = () => run(async () => {
    await leaveFamily(patient.id, token!);
    return `${name} is no longer in a family.`;
  });

  return (
    <>
      <button type="button" onClick={() => setOpenState(true)} className={cn(POP, "text-primary")}
        title="Add to family" aria-label={`Add ${name} to a family`}>
        <Users className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpenState(next); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {name} to a family</DialogTitle>
            <DialogDescription>
              Search the patient list for someone {name} came with. {name} joins their family, or the two start one.
              Queue numbers stay the same; a family moves between stations together.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            {patient.family && (
              <div className={cn("flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2", ENTER_FAST)}>
                <span className="flex min-w-0 items-center gap-2">
                  <FamilyBadge family={patient.family} />
                  <span className="truncate">With {myFamily.map(nameOf).join(", ") || "no one else"}</span>
                </span>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={leave} className="shrink-0 text-destructive">
                  Remove from family
                </Button>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSelected(null); }}
                placeholder="Name, phone or family letter"
                aria-label={`Search the patient list for ${name}'s family`}
                className="pl-9"
              />
            </div>

            <div role="listbox" aria-label="Patients and families found" className="max-h-72 space-y-1.5 overflow-y-auto p-0.5">
              {!text && <p className="px-1 text-muted-foreground">Type to search the patient list.</p>}
              {text && targets.length === 0 && <p className="px-1 text-muted-foreground">No one on the patient list matches.</p>}
              {targets.map((target, index) => {
                const isSelected = selected?.key === target.key;
                const tone = target.family ? familyTone(target.family) : null;
                return (
                  <button
                    key={target.key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-label={target.family ? `Family ${target.family}: ${target.members.map(nameOf).join(", ")}` : nameOf(target.members[0])}
                    disabled={busy}
                    onClick={() => setSelected(isSelected ? null : target)}
                    style={{ animationDelay: `${index * 30}ms` }}
                    className={cn(
                      "group relative flex w-full items-start gap-2 overflow-hidden rounded-lg border py-2 pl-3.5 pr-3 text-left",
                      "transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-px motion-reduce:transform-none",
                      ENTER_FAST,
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent hover:shadow-sm",
                    )}
                  >
                    {/* A family is one box: hovering or picking it highlights the whole family. */}
                    {tone && <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", tone.stripe)} />}
                    <span className="mt-0.5 shrink-0">
                      {target.family ? <FamilyBadge family={target.family} /> : <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      {target.members.map((member) => (
                        <span key={member.id} className="block truncate">{nameOf(member)}</span>
                      ))}
                    </span>
                    <span className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border transition-all duration-200",
                      isSelected ? "scale-100 border-primary bg-primary text-primary-foreground" : "scale-90 border-border text-transparent group-hover:border-primary/50",
                    )}>
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpenState(false)}>Cancel</Button>
            <Button type="button" disabled={busy || !selected} onClick={confirm}>
              {busy ? "Saving..." : !selected
                ? "Pick a family member"
                : selected.family ? `Add to family ${selected.family}` : `Make a family with ${nameOf(selected.members[0])}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}
