"use client"

import { useState } from "react";
import SevaNotesContainer from "@/components/seva/SevaNotesContainer";
import SevaReferralListDialog from "@/components/seva/SevaReferralListDialog";
import PatientContext from "@/components/shared/PatientContext";
import StationSurface from "@/components/shared/StationSurface";
import { StationFlowProvider } from "@/components/shared/StationFlow";
import { QueuedPatient } from "@/lib/types/patient";

export default function Seva() {
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  return (
    <StationFlowProvider station="seva" onSelectPatient={setSelectedPatient}>
      {/* Like Dental: the queue beside the open patient, whose column reads down from what
          Registration and Triage recorded (the Snellen's test among it) to the partner NGO's notes. */}
      <StationSurface station="seva" selectedPatient={selectedPatient} onSelectPatient={setSelectedPatient}
        actions={<SevaReferralListDialog />}>
        {(patient) => (
          <>
            <PatientContext patient={patient} />
            <SevaNotesContainer key={patient.visit_id} patient={patient} />
          </>
        )}
      </StationSurface>
    </StationFlowProvider>
  );
}
