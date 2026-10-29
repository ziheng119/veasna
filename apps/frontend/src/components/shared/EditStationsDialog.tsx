"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, Loader2, Undo2 } from "lucide-react";
import { StationId } from "@/constants/stations";
import { QueuedPatient } from "@/lib/types/patient";
import { updateVisitStations } from "@/lib/api/queue/stations";
import { useUserStore } from "@/stores/useUserStore";
import { Button } from "@/components/ui/button";
import { PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";
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

  const original = useMemo(
    () => (patient?.stations ?? []).filter((s) => !s.completed).map((s) => s.station),
    [patient],
  );
  const completed = (patient?.stations ?? []).filter((s) => s.completed).map((s) => s.station);
  // On TB hold the TB tent stays until a TB doctor clears the patient.
  const onTbHold = (patient?.stations ?? []).some((s) => s.station === "tb" && !s.completed);
  const isDirty = remaining.join() !== original.join();

  useEffect(() => {
    setRemaining(original);
  }, [original]);

  const handleSave = async () => {
    if (!patient || !token || remaining.length === 0 || !isDirty) return;
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Stations for {patient?.english_name || "this patient"}</DialogTitle>
          <DialogDescription>Reorder, add or remove stops. Clinical notes are kept.</DialogDescription>
        </DialogHeader>

        <StationRouteEditor
          route={remaining}
          completed={completed}
          onChange={setRemaining}
          onTbHold={onTbHold}
          disabled={isSaving}
        />

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRemaining(original)}
            disabled={isSaving || !isDirty}
            className={cn(
              "group gap-1.5 rounded-full text-muted-foreground transition-opacity duration-200 disabled:opacity-0",
              PRESS,
            )}
          >
            <Undo2 className="size-3.5 transition-transform duration-300 group-hover:-rotate-45 motion-reduce:transform-none" />
            Undo changes
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className={cn("rounded-full", PRESS)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty || remaining.length === 0}
              title={remaining.length === 0 ? "Add at least one stop, or discharge the patient instead." : undefined}
              className={cn(
                "group gap-1.5 rounded-full px-5 shadow-sm transition duration-200 hover:-translate-y-px hover:shadow-md motion-reduce:transform-none",
                PRESS,
              )}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <Check className="size-4 transition-transform duration-300 group-hover:scale-125 motion-reduce:transform-none" />
              )}
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
