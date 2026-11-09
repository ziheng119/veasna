"use client"

import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { Referral } from "@/lib/types/consultation";
import ReferralPopUp from "./ReferralPopUp";
import GlassButton from "@/components/shared/GlassButton";
import { useState } from "react";

interface Props {
  patient: QueuedPatient;
  patientInfo: PatientInfo;
  retrievedReferral: Referral | null;
  onSaved?: (referral: Referral) => void;
  onDeleted?: () => void;
}

export default function ReferralButton({ patient, patientInfo, retrievedReferral, onSaved, onDeleted }: Props) {
  const [showPopUp, setShowPopUp] = useState(false);
  
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
        setShowPopUp={setShowPopUp}
        showPopUp={showPopUp}
      />
    </>
  );
}