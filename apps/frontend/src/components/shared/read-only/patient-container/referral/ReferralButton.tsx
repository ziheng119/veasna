"use client"

import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { Referral } from "@/lib/types/consultation";
import ReferralPopUp from "./ReferralPopUp";
import GlassButton from "@/components/shared/GlassButton";
import { Dispatch, SetStateAction, useState } from "react";

interface Props {
  patient: QueuedPatient;
  patientInfo: PatientInfo;
  retrievedReferral: Referral | null;
  onSaved?: (referral: Referral) => void;
  onDeleted?: () => void;
  // Opened from elsewhere (e.g. the Dental notes), with what the new referral starts from.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefill?: { reason?: string; referralType?: string[] };
}

export default function ReferralButton({ patient, patientInfo, retrievedReferral, onSaved, onDeleted, open, onOpenChange, prefill }: Props) {
  const [ownOpen, setOwnOpen] = useState(false);
  const showPopUp = open ?? ownOpen;
  const setShowPopUp: Dispatch<SetStateAction<boolean>> = (value) => {
    const next = typeof value === "function" ? value(showPopUp) : value;
    if (onOpenChange) onOpenChange(next); else setOwnOpen(next);
  };
  
  return (
    <>
      <GlassButton type="button"
        onClick={() => setShowPopUp(true)}
      >
        {retrievedReferral ? "Edit referral" : "Create referral"}
      </GlassButton>

      <ReferralPopUp
        onSaved={onSaved}
        onDeleted={onDeleted}
        patient={patient} 
        patientInfo={patientInfo}
        retrievedReferral={retrievedReferral}
        prefill={prefill}
        setShowPopUp={setShowPopUp}
        showPopUp={showPopUp}
      />
    </>
  );
}