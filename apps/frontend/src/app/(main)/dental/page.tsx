"use client"

import { useState } from "react";
import DentalNotesContainer from "@/components/dental/DentalNotesContainer";
import PatientContext from "@/components/shared/PatientContext";
import StationSurface from "@/components/shared/StationSurface";
import { StationFlowProvider } from "@/components/shared/StationFlow";
import { QueuedPatient } from "@/lib/types/patient";

export default function Dental() {
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  return (
    <StationFlowProvider station="dental" onSelectPatient={setSelectedPatient}>
      {/* Like Triage: the queue beside the open patient. Their column reads down: what Registration
          and Triage recorded (Triage shows the tooth problems found there), then the dental notes. */}
      <StationSurface station="dental" selectedPatient={selectedPatient} onSelectPatient={setSelectedPatient}>
        {(patient) => (
          <>
            <PatientContext patient={patient} />
            <DentalNotesContainer key={patient.visit_id} patient={patient} />
          </>
        )}
      </StationSurface>
    </StationFlowProvider>
  );
}
