"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { StationId } from "@/constants/stations";
import { QueuedPatient } from "@/lib/types/patient";
import { updateVisitStations } from "@/lib/api/queue/stations";
import { useUserStore } from "@/stores/useUserStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StationRouteEditor from "./StationRouteEditor";

interface EditStationsDialogProps {
  // Patient whose remaining stations are being edited; null closes the dialog.
  patient: QueuedPatient | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditStationsDialog({ patient, onClose, onSaved }: EditStationsDialogProps) {
  const token = useUserStore((state) => state.user?.token);
  const [remaining, setRemaining] = useState<StationId[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const completed = (patient?.stations ?? []).filter((s) => s.completed).map((s) => s.station);
  // On TB hold the TB tent stays until a TB doctor clears the patient.
  const onTbHold = (patient?.stations ?? []).some((s) => s.station === "tb" && !s.completed);

  useEffect(() => {
    setRemaining((patient?.stations ?? []).filter((s) => !s.completed).map((s) => s.station));
  }, [patient]);

  const handleSave = async () => {
    if (!patient || !token) return;
    if (remaining.length === 0) {
      toast.error("Select at least one station, or discharge the patient instead.");
      return;
    }

    try {
      setIsSaving(true);
      await updateVisitStations(patient.visit_id, remaining, token, patient.stations ?? []);
      toast.success("Stations updated.");
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update stations");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!patient} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stations for {patient?.english_name || "this patient"}</DialogTitle>
          <DialogDescription>
            Set the remaining stops in order. Return to a completed station, or use Skip for now
            to move a stop to the end without completing it. Remove drops a stop from this route.
            Changes take effect when you save; existing clinical notes are kept.
            {onTbHold
              ? " This patient is on TB hold and will stay in the TB tent until a TB doctor clears them."
              : " Add TB Tent if TB is suspected: the patient will be sent there first and held until cleared."}
          </DialogDescription>
        </DialogHeader>

        <StationRouteEditor
          route={remaining}
          completed={completed}
          onChange={setRemaining}
          onTbHold={onTbHold}
          disabled={isSaving}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Please wait..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
