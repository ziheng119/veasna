"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StationId, stationLabel } from "@/constants/stations";
import { setTbFlag } from "@/lib/api/tb/tb";
import { QueuedPatient } from "@/lib/types/patient";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  patient: QueuedPatient;
  // Called with the patient's station after clearing (null when their visit is finished).
  onCleared?: (currentStation: StationId | null) => void;
  className?: string;
}

/**
 * Clears a patient's suspected-TB flag once the doctor has seen them. Shown only in the Consult
 * queue (the server also refuses elsewhere). The patient stays at Consult until the doctor presses
 * Finish.
 */
export default function ClearTbButton({ patient, onCleared, className }: Props) {
  const token = useUserStore((state) => state.user?.token);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const name = patient.english_name || "Patient";

  const clear = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const result = await setTbFlag(patient.visit_id, { flagged: false }, token);
      const station = result.current_station ?? null;
      toast.success(station ? `TB flag cleared. ${name} is in the ${stationLabel(station)} queue.` : "TB flag cleared.");
      setConfirming(false);
      onCleared?.(station);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear TB flag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={saving}
        title="Doctor has seen this patient: clear the TB flag. They stay at Consult until you press Finish."
        aria-label={`Clear TB flag for ${name}`}
        onClick={() => setConfirming(true)}
        className={cn("text-red-700 hover:text-red-800 dark:text-red-300", className)}
      >
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Clear TB
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Clear the TB flag for ${name}?`}
        description={`Do this once a doctor has seen number ${patient.queue_no}. Their red TB marker is removed and they stay in the Consult queue: press Finish when the consultation is done.`}
        confirmLabel="Clear TB flag"
        busy={saving}
        onConfirm={clear}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
