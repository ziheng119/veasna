"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, Check, CircleCheck, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StationId, stationLabel } from "@/constants/stations";
import { completeStation } from "@/lib/api/queue/stations";
import { stationMoveMessage } from "@/lib/family";
import { QueuedPatient } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";

// Moving patients on from a station page: "Save & next" on the forms and the "done" prompt both
// finish the patient's station, send them to their next one, and open the next patient waiting.
// A family member who is done waits here for the rest of the family; the next patient opened is
// then usually the next family member, since families sit together in the queue.
//
// Next on a queue card (and "Send to next station") first saves whatever has been typed into the
// open patient's form, so nothing written is lost. Each form registers itself with
// useSaveBeforeNext; a form left as it was loaded or last saved is not saved again.

// One form (or one Triage section) of the open patient.
interface Draft {
  visitId: number;
  // Something was typed or changed since the form was loaded or last saved.
  unsaved: () => boolean;
  // Saves it; resolves to false when it was not saved (the form shows why).
  save: () => Promise<boolean>;
}

interface StationFlow {
  station: StationId;
  // Finishes the patient's station and opens the next patient in this station's queue.
  advance: (patient: QueuedPatient) => Promise<void>;
  // Called by the queue with the patients as shown, so "next" follows the order on screen.
  registerQueue: (patients: QueuedPatient[], refresh: () => Promise<unknown>) => void;
  // Adds an open form; returns a function that removes it again.
  registerDraft: (draft: Draft) => () => void;
  // Saves the visit's forms that have unsaved changes; resolves to false if any save failed.
  saveDrafts: (visitId: number) => Promise<boolean>;
}

const StationFlowContext = createContext<StationFlow | null>(null);

export function useStationFlow(): StationFlow | null {
  return useContext(StationFlowContext);
}

interface ProviderProps {
  station: StationId;
  onSelectPatient: (patient: QueuedPatient | null) => void;
  children: ReactNode;
}

export function StationFlowProvider({ station, onSelectPatient, children }: ProviderProps) {
  const token = useUserStore((state) => state.user?.token);
  const queue = useRef<{ patients: QueuedPatient[]; refresh?: () => Promise<unknown> }>({ patients: [] });

  const registerQueue = useCallback<StationFlow["registerQueue"]>((patients, refresh) => {
    queue.current = { patients, refresh };
  }, []);

  const drafts = useRef(new Set<Draft>());
  const registerDraft = useCallback((draft: Draft) => {
    drafts.current.add(draft);
    return () => { drafts.current.delete(draft); };
  }, []);
  const saveDrafts = useCallback(async (visitId: number) => {
    for (const draft of Array.from(drafts.current)) {
      if (draft.visitId === visitId && draft.unsaved() && !(await draft.save())) return false;
    }
    return true;
  }, []);

  const advance = useCallback(async (patient: QueuedPatient) => {
    if (!token) throw new Error("Sign in again to continue.");
    const move = await completeStation(patient.visit_id, station, token);
    // The next patient is the first one still to be seen here, in the order shown: not this patient,
    // not family members who just moved on with them, and not anyone already waiting for family.
    const gone = new Set([patient.visit_id, ...move.family_moved.map((member) => member.visit_id)]);
    const next = queue.current.patients.find((other) => !gone.has(other.visit_id) && !other.family_waiting) ?? null;
    onSelectPatient(next);
    toast.success(
      `${stationMoveMessage(patient.english_name || "Patient", move)} ` +
      (next ? `Now seeing number ${next.queue_no}${next.english_name ? `, ${next.english_name}` : ""}.` : "No one else is waiting here."),
      { duration: 5000 },
    );
    await queue.current.refresh?.();
  }, [onSelectPatient, station, token]);

  const value = useMemo(() => ({ station, advance, registerQueue, registerDraft, saveDrafts }),
    [station, advance, registerQueue, registerDraft, saveDrafts]);
  return <StationFlowContext.Provider value={value}>{children}</StationFlowContext.Provider>;
}

/**
 * Lets Next on the patient's queue card save this form first. `values` is what the form saves;
 * `savedVersion` changes whenever the form is loaded or saved (null until it has loaded), and the
 * values at that moment count as saved. Nothing is saved while the form is unchanged.
 */
export function useSaveBeforeNext(visitId: number, savedVersion: string | null, values: unknown, save: () => Promise<boolean>) {
  const flow = useStationFlow();
  const current = JSON.stringify(values);
  const latest = useRef({ current, save });
  latest.current = { current, save };
  const baseline = useRef<{ version: string; values: string } | null>(null);
  // The values shown right after a load or save are the saved ones.
  useEffect(() => {
    baseline.current = savedVersion === null ? null : { version: savedVersion, values: latest.current.current };
  }, [savedVersion]);
  const registerDraft = flow?.registerDraft;
  useEffect(() => registerDraft?.({
    visitId,
    unsaved: () => baseline.current !== null && baseline.current.values !== latest.current.current,
    save: () => latest.current.save(),
  }), [registerDraft, visitId]);
}

interface SaveAndNextProps {
  patient: QueuedPatient;
  // Saves the form; resolves to false when it was not saved (the form shows why).
  onSave: () => Promise<boolean>;
  // Everything needed here is filled in or saved: the button turns green.
  ready?: boolean;
  // The form is saved and can't be changed by this account: sends the patient on without saving.
  locked?: boolean;
  // Shown on hover while not ready, e.g. what is still missing.
  hint?: string;
  disabled?: boolean;
}

/** Beside a form's Save: saves, sends the patient to their next station, and opens the next patient. */
export function SaveAndNextButton({ patient, onSave, ready = false, locked = false, hint, disabled = false }: SaveAndNextProps) {
  const flow = useStationFlow();
  const [busy, setBusy] = useState(false);
  if (!flow) return null;

  const saveAndNext = async () => {
    setBusy(true);
    try {
      if (locked || await onSave()) await flow.advance(patient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saved, but could not send the patient on. Use Next in the queue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant={ready ? "success" : "outline"} disabled={disabled || busy} onClick={saveAndNext}
      // Re-mounting the class replays the pop each time the form becomes complete.
      key={ready ? "ready" : "not-ready"} className={cn("group/next", ready && "ready-pop")}
      title={ready ? `Ready: ${locked ? "send" : "save and send"} the patient to their next station` : hint}>
      {ready && <Check aria-hidden="true" className="animate-in zoom-in-50 duration-300 motion-reduce:animate-none" />}
      {busy ? (locked ? "Sending..." : "Saving...") : locked ? "Next station" : "Save & next"}
      <ArrowRight aria-hidden="true" className="transition-transform duration-200 group-hover/next:translate-x-0.5" />
      {ready && <span className="sr-only">(form complete)</span>}
    </Button>
  );
}

/**
 * Shown once everything needed at this station is saved: offers to send the patient on, which also
 * opens the next patient waiting here.
 */
export function StationDonePrompt({ patient, done }: { patient: QueuedPatient; done: boolean }) {
  const flow = useStationFlow();
  const [busy, setBusy] = useState(false);
  if (!flow || !done) return null;

  const sendOn = async () => {
    setBusy(true);
    try {
      if (!(await flow.saveDrafts(patient.visit_id))) return;
      await flow.advance(patient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the patient on.");
    } finally {
      setBusy(false);
    }
  };

  if (patient.family_waiting) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        <Hourglass className="size-4" aria-hidden="true" />
        Done at {stationLabel(flow.station)}: waiting for the rest of family {patient.family} here. They move on together.
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/50 bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
      <span className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
        <CircleCheck className="size-4" aria-hidden="true" />
        Done at {stationLabel(flow.station)}: everything needed here is saved.
      </span>
      <Button type="button" size="sm" disabled={busy} onClick={sendOn} className="gap-1.5">
        {busy ? "Sending..." : "Send to next station"}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
