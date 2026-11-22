"use client"

import { useState } from "react";
import PhysiotherapyNotesContainer from "@/components/physiotherapy/PhysiotherapyNotesContainer";
import PatientContext from "@/components/shared/PatientContext";
import StationSurface from "@/components/shared/StationSurface";
import { StationFlowProvider } from "@/components/shared/StationFlow";
import { QueuedPatient } from "@/lib/types/patient";

export default function Physiotherapy() {
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  return (
    <StationFlowProvider station="physiotherapy" onSelectPatient={setSelectedPatient}>
      {/* Like Dental: the queue beside the open patient, whose column reads down from what
          Registration and Triage recorded to the physiotherapy notes and body chart. */}
      <StationSurface station="physiotherapy" selectedPatient={selectedPatient} onSelectPatient={setSelectedPatient}>
        {(patient) => (
          <>
            <PatientContext patient={patient} />
            <PhysiotherapyNotesContainer key={patient.visit_id} patient={patient} />
          </>
        )}
      </StationSurface>
    </StationFlowProvider>
  );
}
