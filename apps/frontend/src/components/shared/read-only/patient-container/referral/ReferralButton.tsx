"use client"

import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { Referral } from "@/lib/types/consultation";
import ReferralPopUp from "./ReferralPopUp";
import { useState } from "react";

interface Props {
  patient: QueuedPatient;
  patientInfo: PatientInfo;
  retrievedReferral: Referral | null;
}

export default function ReferralButton({ patient, patientInfo, retrievedReferral }: Props) {
  const [showPopUp, setShowPopUp] = useState(false);
  
  return (
    <>
      <button 
        className="bg-green-default rounded-md p-2 hover:cursor-pointer"
        onClick={() => setShowPopUp(true)}
      >
        Create/Edit Referral
      </button>

      <ReferralPopUp
        patient={patient} 
        patientInfo={patientInfo}
        retrievedReferral={retrievedReferral}
        setShowPopUp={setShowPopUp}
        showPopUp={showPopUp}
      />
    </>
  );
}