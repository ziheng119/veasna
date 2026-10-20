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
}

export default function ReferralButton({ patient, patientInfo, retrievedReferral, onSaved }: Props) {
  const [showPopUp, setShowPopUp] = useState(false);
  
  return (
    <>
      <GlassButton type="button"
        onClick={() => setShowPopUp(true)}
      >
        Create/Edit Referral
      </GlassButton>

      <ReferralPopUp
        onSaved={onSaved}
        patient={patient} 
        patientInfo={patientInfo}
        retrievedReferral={retrievedReferral}
        setShowPopUp={setShowPopUp}
        showPopUp={showPopUp}
      />
    </>
  );
}