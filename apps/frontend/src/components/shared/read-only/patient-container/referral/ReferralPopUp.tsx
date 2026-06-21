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
}

export default function ReferralPopUp({ 
  patient, 
  patientInfo, 
  retrievedReferral, 
  setShowPopUp,
  showPopUp 
}: Props) {
  return (
    <Dialog open={showPopUp} onOpenChange={setShowPopUp}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-none opacity-100 [&>*]:opacity-100">
        <VisuallyHidden>
          <DialogTitle>Referral Form</DialogTitle>
        </VisuallyHidden>
        <ReferralForm
          patient={patient}
          patientInfo={patientInfo}
          retrievedReferral={retrievedReferral}
          onClose={() => setShowPopUp(false)}
        />
      </DialogContent>
    </Dialog>
  );
}