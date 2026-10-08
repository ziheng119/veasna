"use client";

import { PatientInfo } from "@/lib/types/patient";
import { calculateAge } from "@/helper/calculate_age";
import formatDate from "@/helper/format_date";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface ExistingPatientDialogProps {
  open: boolean;
  matches: PatientInfo[];
  description: string;
  onSelect: (patient: PatientInfo) => void;
  // When provided, offers registering a new patient despite the matches.
  onRegisterNew?: () => void;
  onClose: () => void;
}

export function ExistingPatientDialog({
  open,
  matches,
  description,
  onSelect,
  onRegisterNew,
  onClose,
}: ExistingPatientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Existing Patient</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {matches.map((patient) => {
            const age = calculateAge(patient.date_of_birth);
            const details = [
              patient.date_of_birth ? `DOB ${formatDate(patient.date_of_birth)}` : null,
              age !== null ? `Age ${age}` : null,
              patient.sex || null,
              patient.phone_number || null,
              patient.face_id ? `Face ID ${patient.face_id}` : null,
            ].filter(Boolean).join(" • ");

            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => onSelect(patient)}
                className="w-full rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">
                    {patient.english_name || patient.khmer_name}
                    {patient.english_name && patient.khmer_name ? ` (${patient.khmer_name})` : ""}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    Patient ID {patient.id}
                  </span>
                </div>
                {details && <p className="mt-1 text-xs text-muted-foreground">{details}</p>}
                {patient.address && <p className="mt-1 text-xs text-muted-foreground">{patient.address}</p>}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {onRegisterNew && (
            <Button type="button" onClick={onRegisterNew}>
              Register as New Patient
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
