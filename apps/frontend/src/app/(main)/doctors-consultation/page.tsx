"use client"

import { useState } from "react";
import DoctorsNotesContainer from "@/components/doctors-consultation/DoctorsNotesContainer";
import PrintReferrals from "@/components/doctors-consultation/PrintReferrals";
import PatientContext from "@/components/shared/PatientContext";
import StationSurface from "@/components/shared/StationSurface";
import { StationFlowProvider } from "@/components/shared/StationFlow";
import { QueuedPatient } from "@/lib/types/patient";

export default function DoctorsConsultation() {
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  return (
    <StationFlowProvider station="consultation" onSelectPatient={setSelectedPatient}>
      {/* Like Dental: the queue beside the open patient, whose column reads down from what
          Registration and Triage recorded to the consultation notes and prescribing. */}
      <StationSurface station="consultation" selectedPatient={selectedPatient} onSelectPatient={setSelectedPatient}
        actions={<PrintReferrals />}>
        {(patient) => (
          <>
            <PatientContext patient={patient} />
            <DoctorsNotesContainer key={patient.visit_id} patient={patient} />
          </>
        )}
      </StationSurface>
    </StationFlowProvider>
  );
}
