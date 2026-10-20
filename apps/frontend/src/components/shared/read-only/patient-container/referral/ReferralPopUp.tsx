import React, { Dispatch, SetStateAction } from "react";
import ReferralForm from "@/components/doctors-consultation/Referral";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { Referral } from "@/lib/types/consultation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Props {
  patient: QueuedPatient;
  patientInfo: PatientInfo;
  retrievedReferral: Referral | null;
  setShowPopUp: Dispatch<SetStateAction<boolean>>;
  showPopUp: boolean;
  onSaved?: (referral: Referral) => void;
  onDeleted?: () => void;
}

export default function ReferralPopUp({ 
  patient, 
  patientInfo, 
  retrievedReferral, 
  setShowPopUp,
  showPopUp,
  onSaved,
  onDeleted
}: Props) {
  return (
    <Dialog open={showPopUp} onOpenChange={setShowPopUp}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-card p-0">
        <VisuallyHidden>
          <DialogTitle>Referral Form</DialogTitle>
        </VisuallyHidden>
        <ReferralForm
          key={patient.visit_id}
          onSaved={onSaved}
          onDeleted={onDeleted}
          patient={patient}
          patientInfo={patientInfo}
          retrievedReferral={retrievedReferral}
          onClose={() => setShowPopUp(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
