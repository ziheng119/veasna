"use client"

import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { Referral } from "@/lib/types/consultation";
import ReferralPopUp from "./ReferralPopUp";
import GlassButton from "@/components/shared/GlassButton";
import { useUserStore } from "@/stores/useUserStore";
import { useState } from "react";

interface Props {
  patient: QueuedPatient;
  patientInfo: PatientInfo;
  retrievedReferral: Referral | null;
  onSaved?: (referral: Referral) => void;
  onDeleted?: () => void;
}

export default function ReferralButton({ patient, patientInfo, retrievedReferral, onSaved, onDeleted }: Props) {
  const isAdmin = useUserStore(state => state.user?.role === "admin");
  const [showPopUp, setShowPopUp] = useState(false);
  
  return (
    <>
      <GlassButton type="button"
        onClick={() => setShowPopUp(true)}
      >
        {retrievedReferral ? (isAdmin ? "Edit referral" : "View referral") : "Create referral"}
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