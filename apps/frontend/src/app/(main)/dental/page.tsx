"use client"

import DentalNotesContainer from "@/components/dental/DentalNotesContainer";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import PatientContainer from "@/components/shared/read-only/patient-container/PatientContainer";
import TriageContainer from "@/components/shared/read-only/triage-container/TriageContainer";
import SearchBar from "@/components/shared/SearchBar";
import { QueuedPatient } from "@/lib/types/patient";
import { useState } from "react";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";
import { StationFlowProvider } from "@/components/shared/StationFlow";

export default function Dental() {

  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);


  return (
    <StationFlowProvider station="dental" onSelectPatient={setSelectedPatient}>
      <div className={PAGE_SHELL}>
        <SearchBar station="dental" onSelectPatient={setSelectedPatient} />
        <div className={PANEL_GRID}>
          <QueuePatientPicker
            station="dental"
            onSelectPatient={setSelectedPatient}
            selectedVisitId={selectedPatient?.visit_id}
          />
          <div data-tour="station-work" className={`${PANEL_WRAPPER} xl:col-span-8`}>
            {!selectedPatient ? (
              <NoPatientSelected />
            ) : (
              <div className={PANEL_GRID}>
                <PatientContainer selectedPatient = {selectedPatient}/>
                {/* Triage notes show the tooth problems found at Triage. */}
                <TriageContainer selectedPatient = {selectedPatient}/>
                <DentalNotesContainer key={selectedPatient.visit_id} patient={selectedPatient} />
              </div>
            )}
          </div>
        </div>
      </div>
    </StationFlowProvider>
  )
}