"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, Check, CircleCheck, Hourglass, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StationId, stationLabel } from "@/constants/stations";
import { completeStation } from "@/lib/api/queue/stations";
import { getVisit } from "@/lib/api/visit/getVisit";
import { ENTER_FAST } from "@/lib/motion";
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

//
// When the open patient leaves this station's queue from another device (sent on, finished or
// discharged there), anything typed for them here is saved, their forms close, and the empty panel
// says where they went (StationDepartureNotice). If that save fails, the forms stay open with the
// reason, so nothing typed is lost.

// One form (or one Triage section) of the open patient.
interface Draft {
  visitId: number;
  // Something was typed or changed since the form was loaded or last saved.
  unsaved: () => boolean;
  // Saves it; resolves to false when it was not saved (the form shows why).
  save: () => Promise<boolean>;
}

// The patient who was open here when they were moved on from another device.
export interface Departure {
  visitId: number;
  queueNo: string;
  name: string;
  // Their station now; "finished" when their visit is over; null when it couldn't be looked up.
  now: StationId | "finished" | null;
  // What was typed for them here: saved, couldn't be saved (their forms stay open), or nothing.
  draft: "saved" | "failed" | null;
}

interface StationFlow {
  station: StationId;
  // Set when the open patient was moved on from another device; cleared on the next selection.
  departure: Departure | null;
  // The queue saw the open patient leave without this device moving them. `stillOpen` tells
  // whether they are still the open patient once their typing is saved.
  patientLeft: (patient: QueuedPatient, stillOpen: () => boolean) => Promise<void>;
  clearDeparture: () => void;
  // Closes a patient whose forms stayed open after they left (a save failed), keeping the notice.
  closeDeparted: () => void;
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

  const [departure, setDeparture] = useState<Departure | null>(null);
  const clearDeparture = useCallback(() => setDeparture(null), []);
  const closeDeparted = useCallback(() => {
    setDeparture((previous) => previous && { ...previous, draft: null });
    onSelectPatient(null);
  }, [onSelectPatient]);
  const patientLeft = useCallback(async (patient: QueuedPatient, stillOpen: () => boolean) => {
    const typed = Array.from(drafts.current).some((draft) => draft.visitId === patient.visit_id && draft.unsaved());
    const [saved, now] = await Promise.all([
      typed ? saveDrafts(patient.visit_id) : Promise.resolve(null),
      token ? stationNow(patient.visit_id, token) : Promise.resolve(null),
    ]);
    // Another patient was opened meanwhile: they have moved on themselves.
    if (!stillOpen()) return;
    const draft = saved === null ? null : saved ? "saved" : "failed";
    setDeparture({ visitId: patient.visit_id, queueNo: patient.queue_no, name: patient.english_name || "The patient", now, draft });
    if (draft !== "failed") onSelectPatient(null);
  }, [onSelectPatient, saveDrafts, token]);

  const advance = useCallback(async (patient: QueuedPatient) => {
    if (!token) throw new Error("Sign in again to continue.");
    setDeparture(null);
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

  const value = useMemo(() => ({ station, advance, registerQueue, registerDraft, saveDrafts, departure, patientLeft, clearDeparture, closeDeparted }),
    [station, advance, registerQueue, registerDraft, saveDrafts, departure, patientLeft, clearDeparture, closeDeparted]);
  return <StationFlowContext.Provider value={value}>{children}</StationFlowContext.Provider>;
}

// Where a visit is now: its first station not done, or "finished". null if it can't be looked up.
async function stationNow(visitId: number, token: string): Promise<Departure["now"]> {
  try {
    const visit: { completed_at: string | null; stations?: { station: StationId; completed_at: string | null }[] } | null =
      await getVisit(visitId, token);
    if (!visit) return null;
    if (visit.completed_at) return "finished";
    return visit.stations?.find((entry) => !entry.completed_at)?.station ?? null;
  } catch {
    return null;
  }
}

// "Queue 12, Sok Dara, was sent to Pharmacy from another device."
export function departureMessage(departure: Departure, station: StationId): string {
  const who = `Queue ${departure.queueNo}, ${departure.name},`;
  if (departure.now === "finished") return `${who} finished their visit on another device.`;
  if (departure.now && departure.now !== station) return `${who} was sent to ${stationLabel(departure.now)} from another device.`;
  return `${who} is no longer waiting at ${stationLabel(station)}: moved on from another device.`;
}

/**
 * Where the open patient went when another device moved them on, shown where their forms were.
 * Nothing when no patient left this way.
 */
export function StationDepartureNotice({ className }: { className?: string }) {
  const flow = useStationFlow();
  const departure = flow?.departure;
  if (!flow || !departure || departure.draft === "failed") return null;
  return (
    <div key={departure.visitId} role="status"
      className={cn("flex items-start gap-3 rounded-lg border border-sky-500/40 bg-sky-50 px-3 py-2.5 text-left text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-200", ENTER_FAST, className)}>
      <LogOut className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="block font-medium">{departureMessage(departure, flow.station)}</span>
        <span className="block text-sky-800/90 dark:text-sky-200/80">
          {departure.draft === "saved" ? "What you had typed for them was saved first. " : ""}Choose the next patient from the queue.
        </span>
      </span>
    </div>
  );
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
  const baseline = useSavedBaseline(savedVersion, current);
  const registerDraft = flow?.registerDraft;
  useEffect(() => registerDraft?.({
    visitId,
    unsaved: () => baseline.current !== null && baseline.current.values !== latest.current.current,
    save: () => latest.current.save(),
  }), [registerDraft, visitId, baseline]);
}

/**
 * The form's values (as JSON) when it was last loaded or saved: the values shown right after
 * `savedVersion` changes. null until the form has loaded. Comparing with the current values tells
 * whether anything was typed since.
 */
export function useSavedBaseline(savedVersion: string | null, current: string) {
  const latest = useRef(current);
  latest.current = current;
  const baseline = useRef<{ version: string; values: string } | null>(null);
  useEffect(() => {
    baseline.current = savedVersion === null ? null : { version: savedVersion, values: latest.current };
  }, [savedVersion]);
  return baseline;
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
  // Moved on from another device, but what was typed here couldn't be saved: the form stays open.
  if (flow?.departure?.visitId === patient.visit_id && flow.departure.draft === "failed") {
    return (
      <div role="alert" className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive", ENTER_FAST)}>
        <span className="flex items-start gap-2 font-medium">
          <LogOut className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {departureMessage(flow.departure, flow.station)} What you typed here isn&apos;t saved: fix what the message says and save, then close.
        </span>
        <Button type="button" size="sm" variant="outline" className="bg-background" onClick={() => flow.closeDeparted()}>
          Close patient
        </Button>
      </div>
    );
  }
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
