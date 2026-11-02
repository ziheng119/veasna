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

interface Props {
  patient: QueuedPatient;
  // Called with the patient's station after clearing (null when their visit is finished).
  onCleared?: (currentStation: StationId | null) => void;
  className?: string;
}

/**
 * Clears a patient's suspected-TB flag once a doctor has seen them in the TB tent. Anyone may.
 * The patient stays at, or goes to, Consultation, since the tent visit is their consultation.
 */
export default function ClearTbButton({ patient, onCleared, className }: Props) {
  const token = useUserStore((state) => state.user?.token);
  const [saving, setSaving] = useState(false);
  const name = patient.english_name || "Patient";

  const clear = async () => {
    if (!token) return;
    if (!window.confirm(
      `Clear the TB flag for ${name} (number ${patient.queue_no})? Do this once a doctor has seen them. ` +
      "They go to the Consult queue and their red TB marker is removed."
    )) return;
    setSaving(true);
    try {
      const result = await setTbFlag(patient.visit_id, { flagged: false }, token);
      const station = result.current_station ?? null;
      toast.success(station ? `TB flag cleared. ${name} is in the ${stationLabel(station)} queue.` : "TB flag cleared.");
      onCleared?.(station);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear TB flag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={saving}
      title="Doctor has seen this patient: clear the TB flag and send them to Consult"
      aria-label={`Clear TB flag for ${name}`}
      onClick={clear}
      className={cn("text-red-700 hover:text-red-800 dark:text-red-300", className)}
    >
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      {saving ? "Clearing" : "Clear TB"}
    </Button>
  );
}
