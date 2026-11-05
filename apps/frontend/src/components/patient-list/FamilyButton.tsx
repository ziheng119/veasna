"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FamilyBadge from "@/components/shared/FamilyBadge";
import { CLINIC_TODAY, getQueue } from "@/lib/api/queue/getQueue";
import { joinFamily, leaveFamily } from "@/lib/api/family";
import { QueuedPatient } from "@/lib/types/patient";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserStore } from "@/stores/useUserStore";

const MAX_RESULTS = 6;

interface Props {
  patientId: number;
  patientName: string;
  // Tells the row the pop-up is open, so the list can show which patient it is about.
  onOpenChange?: (open: boolean) => void;
}

const matches = (patient: QueuedPatient, text: string) =>
  [patient.queue_no, patient.english_name, patient.khmer_name].some((value) => value?.toLowerCase().includes(text));

/**
 * "Add to family" on a Patient List row: opens a pop-up over the list to put the patient in any of
 * today's families, start a family with someone else in today's queue, or leave their family.
 * Queue numbers don't change; family members move between stations together.
 */
export default function FamilyButton({ patientId, patientName, onOpenChange }: Props) {
  const token = useUserStore((state) => state.user?.token);
  const locationId = useLocationStore((state) => state.currentLocation?.id);
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<QueuedPatient[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) setQuery("");
  };

  // Today's queue is loaded only when the pop-up is opened, so the list stays light.
  useEffect(() => {
    if (!open || !token || !locationId) return;
    const controller = new AbortController();
    setQueue(null);
    getQueue(locationId, CLINIC_TODAY, token, undefined, controller.signal)
      .then((patients: QueuedPatient[]) => setQueue(patients))
      .catch(() => { if (!controller.signal.aborted) toast.error("Failed to load today's queue"); });
    return () => controller.abort();
  }, [open, token, locationId]);

  const mine = queue?.find((patient) => patient.patient_id === patientId) ?? null;
  const text = query.trim().toLowerCase();

  // Today's families other than the patient's own, each with its members; and everyone else.
  const { families, others } = useMemo(() => {
    const rest = (queue ?? []).filter((patient) => patient.patient_id !== patientId);
    const byFamily = new Map<string, QueuedPatient[]>();
    for (const patient of rest) {
      if (patient.family && patient.family !== mine?.family) byFamily.set(patient.family, [...(byFamily.get(patient.family) ?? []), patient]);
    }
    return {
      families: Array.from(byFamily.entries())
        .filter(([family, members]) => !text || family.toLowerCase() === text || members.some((member) => matches(member, text)))
        .sort(([a], [b]) => a.length - b.length || a.localeCompare(b)),
      others: rest.filter((patient) => !patient.family && (!text || matches(patient, text))).slice(0, MAX_RESULTS),
    };
  }, [queue, patientId, mine?.family, text]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      toast.success(await action(), { duration: 5000 });
      setOpenState(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the family");
    } finally {
      setBusy(false);
    }
  };

  const join = (other: QueuedPatient) => run(async () => {
    const result = await joinFamily(mine!.visit_id, other.visit_id, token!);
    const them = other.english_name ? `${other.english_name} (${other.queue_no})` : `number ${other.queue_no}`;
    return `${patientName} (${mine!.queue_no}) is in family ${result.family} with ${them}.`;
  });

  const leave = () => run(async () => {
    await leaveFamily(mine!.visit_id, token!);
    return `${patientName} (${mine!.queue_no}) is no longer in a family.`;
  });

  const nameOf = (patient: QueuedPatient) => `${patient.queue_no} ${patient.english_name || "Unknown name"}`;

  return (
    <>
      <button type="button" onClick={() => setOpenState(true)} className="text-primary hover:text-primary/80"
        title="Add to family" aria-label={`Add ${patientName} to a family`}>
        <Users className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpenState(next); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {patientName} to a family</DialogTitle>
            <DialogDescription>
              {mine
                ? <>Number {mine.queue_no}{mine.family ? `, in family ${mine.family}` : ""}. Queue numbers stay the same; a family moves between stations together.</>
                : queue === null ? "Loading today's queue…" : `${patientName} isn't in today's queue at this location.`}
            </DialogDescription>
          </DialogHeader>

          {mine && (
            <div className="space-y-4 text-sm">
              {mine.family && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span className="flex items-center gap-2">In family <FamilyBadge family={mine.family} /></span>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={leave} className="text-destructive">
                    Remove from family {mine.family}
                  </Button>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, number or family letter"
                  aria-label={`Find a family member for ${patientName} in today's queue`}
                  className="pl-9"
                />
              </div>

              <section aria-label="Today's families" className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Join a family</h3>
                {families.length === 0 && <p className="text-muted-foreground">{text ? "No family matches." : "No other families today yet."}</p>}
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {families.map(([family, members]) => (
                    <button key={family} type="button" disabled={busy} onClick={() => join(members[0])}
                      aria-label={`Join family ${family}`}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50">
                      <FamilyBadge family={family} />
                      <span className="min-w-0 flex-1 truncate">{members.map(nameOf).join(", ")}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section aria-label="Patients not in a family" className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {mine.family ? `Add to family ${mine.family}` : "Start a family with"}
                </h3>
                {others.length === 0 && <p className="text-muted-foreground">{text ? "No one else matches." : "Everyone else today is in a family."}</p>}
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {others.map((other) => (
                    <button key={other.visit_id} type="button" disabled={busy} onClick={() => join(other)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50">
                      <span className="min-w-[2.5rem] font-bold tabular-nums">{other.queue_no}</span>
                      <span className="min-w-0 truncate">{other.english_name || "Unknown name"}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
