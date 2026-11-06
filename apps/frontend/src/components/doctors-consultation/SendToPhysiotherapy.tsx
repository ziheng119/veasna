"use client";

import { useId, useState } from "react";
import toast from "react-hot-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TB_ROUTE_LOCKED_HINT } from "@/constants/tb";
import { setStationNeeded } from "@/lib/api/queue/stations";
import { QueuedPatient } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";

/**
 * The doctor decides at Consult whether the patient goes to Physiotherapy; it is not offered at
 * registration. Ticking adds it to the patient's route in clinic order, straight away.
 */
export default function SendToPhysiotherapy({ patient }: { patient: QueuedPatient }) {
  const token = useUserStore((state) => state.user?.token);
  const id = useId();
  const stations = patient.stations ?? [];
  const done = stations.some((s) => s.station === "physiotherapy" && s.completed);
  const [queued, setQueued] = useState(stations.some((s) => s.station === "physiotherapy" && !s.completed));
  const [saving, setSaving] = useState(false);
  // A TB patient only goes to Consult (and Pharmacy).
  const tbPatient = patient.tb_status != null;

  const toggle = async (needed: boolean) => {
    if (!token) return;
    setSaving(true);
    try {
      await setStationNeeded(patient.visit_id, "physiotherapy", needed, token);
      setQueued(needed);
      toast.success(needed ? "Physiotherapy added to the patient's route." : "Physiotherapy taken off the patient's route.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update stations");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-2 rounded-xl border border-border p-4">
      <Checkbox
        id={id}
        checked={done || queued}
        disabled={done || tbPatient || saving}
        onCheckedChange={(checked) => toggle(checked === true)}
        className="mt-0.5"
      />
      <div>
        <Label htmlFor={id} className="font-semibold">Send to Physiotherapy</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {done ? "Already seen at Physiotherapy." : tbPatient ? TB_ROUTE_LOCKED_HINT : "Added after Consult, before the patient's other stations."}
        </p>
      </div>
    </div>
  );
}
