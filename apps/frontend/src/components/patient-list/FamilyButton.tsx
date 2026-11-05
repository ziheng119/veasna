"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Users, X } from "lucide-react";
import { CLINIC_TODAY, getQueue } from "@/lib/api/queue/getQueue";
import { joinFamily, leaveFamily } from "@/lib/api/family";
import { QueuedPatient } from "@/lib/types/patient";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 6;
const RESULTS_WIDTH = 288;

// A family letter is on the end of the number: 3A is in family A.
const familyOf = (queueNo: string) => /^\d+([A-Z]+)$/.exec(queueNo)?.[1] ?? null;

interface Props {
  patientId: number;
  patientName: string;
}

/**
 * "Add to family" on a Patient List row: an icon that expands into a search of today's queue. Picking
 * someone gives both patients the same family letter (3 and 4 become 3A and 4A); joining someone
 * already in a family takes their letter. A patient in a family can be taken out again.
 */
export default function FamilyButton({ patientId, patientName }: Props) {
  const token = useUserStore((state) => state.user?.token);
  const locationId = useLocationStore((state) => state.currentLocation?.id);
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<QueuedPatient[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  // The results float over the page (the table scrolls and would clip them), under the search box.
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = anchor.current?.getBoundingClientRect();
      if (box) setPosition({ top: box.bottom + 4, left: Math.max(8, box.right - RESULTS_WIDTH) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Today's queue is loaded only when the search is opened, so the list stays light.
  useEffect(() => {
    if (!open || !token || !locationId) return;
    const controller = new AbortController();
    setQueue(null);
    getQueue(locationId, CLINIC_TODAY, token, undefined, controller.signal)
      .then((patients: QueuedPatient[]) => setQueue(patients))
      .catch(() => { if (!controller.signal.aborted) toast.error("Failed to load today's queue"); });
    input.current?.focus();
    return () => controller.abort();
  }, [open, token, locationId]);

  const mine = queue?.find((patient) => patient.patient_id === patientId) ?? null;
  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (queue ?? [])
      .filter((patient) => patient.patient_id !== patientId)
      .filter((patient) => !text || [patient.queue_no, patient.english_name, patient.khmer_name]
        .some((value) => value?.toLowerCase().includes(text)))
      .slice(0, MAX_RESULTS);
  }, [queue, query, patientId]);

  const close = () => { setOpen(false); setQuery(""); };

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      toast.success(await action(), { duration: 5000 });
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the family");
    } finally {
      setBusy(false);
    }
  };

  const join = (other: QueuedPatient) => run(async () => {
    const result = await joinFamily(mine!.visit_id, other.visit_id, token!);
    const [me, them] = result.visits;
    return `${patientName} is now ${me.queue_no}, in family ${result.family} with ${other.english_name || "them"} (${them.queue_no}).`;
  });

  const leave = () => run(async () => {
    const result = await leaveFamily(mine!.visit_id, token!);
    return `${patientName} is now ${result.queue_no}, not in a family.`;
  });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-primary hover:text-primary/80"
        title="Add to family" aria-label={`Add ${patientName} to a family`}>
        <Users className="size-4" />
      </button>
    );
  }

  return (
    <div onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
      <div ref={anchor} className="flex w-56 items-center gap-1 rounded-md border border-input bg-background px-2 py-1">
        <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Family member: name or number"
          aria-label={`Find a family member for ${patientName} in today's queue`}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button type="button" onClick={close} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      {position && createPortal(
      <div
        style={{ top: position.top, left: position.left, width: RESULTS_WIDTH }}
        className="fixed z-50 rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md"
        onKeyDown={(event) => { if (event.key === "Escape") close(); }}
      >
        {queue === null ? (
          <p className="px-2 py-1.5 text-muted-foreground">Loading today&apos;s queue…</p>
        ) : !mine ? (
          <p className="px-2 py-1.5 text-muted-foreground">{patientName} isn&apos;t in today&apos;s queue at this location.</p>
        ) : (
          <>
            {familyOf(mine.queue_no) && (
              <button type="button" disabled={busy} onClick={leave}
                className="w-full rounded px-2 py-1.5 text-left text-destructive hover:bg-accent">
                Remove {mine.queue_no} from family {familyOf(mine.queue_no)}
              </button>
            )}
            {results.length === 0 && <p className="px-2 py-1.5 text-muted-foreground">No one else in today&apos;s queue matches.</p>}
            {results.map((other) => (
              <button key={other.visit_id} type="button" disabled={busy} onClick={() => join(other)}
                className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent", busy && "opacity-50")}>
                <span className="min-w-[2.5rem] font-bold tabular-nums">{other.queue_no}</span>
                <span className="min-w-0 truncate">{other.english_name || "Unknown name"}</span>
                {familyOf(other.queue_no) && <span className="ml-auto text-xs text-muted-foreground">family {familyOf(other.queue_no)}</span>}
              </button>
            ))}
          </>
        )}
      </div>,
      document.body,
      )}
    </div>
  );
}
