"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StationId, stationLabel } from "@/constants/stations";
import { completeStation } from "@/lib/api/queue/stations";
import { QueuedPatient } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";

// Moving patients on from a station page: "Save & next" on the forms and the "done" prompt both
// finish the patient's station, send them to their next one, and open the next patient waiting.

interface StationFlow {
  station: StationId;
  // Finishes the patient's station and opens the next patient in this station's queue.
  advance: (patient: QueuedPatient) => Promise<void>;
  // Called by the queue with the patients as shown, so "next" follows the order on screen.
  registerQueue: (patients: QueuedPatient[], refresh: () => Promise<unknown>) => void;
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

  const advance = useCallback(async (patient: QueuedPatient) => {
    if (!token) throw new Error("Sign in again to continue.");
    const nextStation = await completeStation(patient.visit_id, station, token);
    // The next patient is the first one still waiting here, in the order shown.
    const next = queue.current.patients.find((other) => other.visit_id !== patient.visit_id) ?? null;
    onSelectPatient(next);
    const name = patient.english_name || "Patient";
    toast.success(
      `${name} ${nextStation ? `sent to ${stationLabel(nextStation)}` : "has finished all stations"}. ` +
      (next ? `Now seeing number ${next.queue_no}${next.english_name ? `, ${next.english_name}` : ""}.` : "No one else is waiting here."),
      { duration: 5000 },
    );
    await queue.current.refresh?.();
  }, [onSelectPatient, station, token]);

  const value = useMemo(() => ({ station, advance, registerQueue }), [station, advance, registerQueue]);
  return <StationFlowContext.Provider value={value}>{children}</StationFlowContext.Provider>;
}

interface SaveAndNextProps {
  patient: QueuedPatient;
  // Saves the form; resolves to false when it was not saved (the form shows why).
  onSave: () => Promise<boolean>;
  disabled?: boolean;
}

/** Beside a form's Save: saves, sends the patient to their next station, and opens the next patient. */
export function SaveAndNextButton({ patient, onSave, disabled = false }: SaveAndNextProps) {
  const flow = useStationFlow();
  const [busy, setBusy] = useState(false);
  if (!flow) return null;

  const saveAndNext = async () => {
    setBusy(true);
    try {
      if (await onSave()) await flow.advance(patient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saved, but could not send the patient on. Use Next in the queue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" disabled={disabled || busy} onClick={saveAndNext} className="gap-1.5">
      {busy ? "Saving..." : "Save & next"}
      <ArrowRight className="size-4" aria-hidden="true" />
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
      await flow.advance(patient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the patient on.");
    } finally {
      setBusy(false);
    }
  };

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
