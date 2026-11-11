"use client"

import PatientContainer from "@/components/shared/read-only/patient-container/PatientContainer";
import TriageContainer from "@/components/shared/read-only/triage-container/TriageContainer";
import DoctorsNotesContainer from "@/components/doctors-consultation/DoctorsNotesContainer";
import SearchBar from "@/components/shared/SearchBar";
import { QueuedPatient } from "@/lib/types/patient";
import { useState } from "react";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import { useLocationReminder } from "@/hooks/useLocationReminder";
import { useLocationStore } from "@/stores/useLocationStore";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";
import PrintReferrals from "@/components/doctors-consultation/PrintReferrals";
import { StationFlowProvider } from "@/components/shared/StationFlow";
import StationDataButton from "@/components/shared/StationDataButton";

// Queue, patient snapshot and triage summary share the top row; the consultation notes take the
// full page width underneath. The page scrolls as a whole instead of fitting one screen.
const TOP_ROW = "grid grid-cols-1 gap-6 xl:h-[30rem] xl:grid-cols-12 xl:grid-rows-1";

export default function DoctorsConsultation() {
  const location = useLocationStore((state) => state.currentLocation);
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  useLocationReminder();

  return (
    <StationFlowProvider station="consultation" onSelectPatient={setSelectedPatient}>
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><SearchBar station="consultation" onSelectPatient={setSelectedPatient} /></div>
          <div className="flex items-center gap-3">
            <PrintReferrals locationId={location?.id} />
            <StationDataButton station="consultation" />
          </div>
        </div>
        <div className={TOP_ROW}>
          <QueuePatientPicker
            station="consultation"
            onSelectPatient={setSelectedPatient}
            selectedVisitId={selectedPatient?.visit_id}
          />
          {!selectedPatient ? (
            <div data-tour="station-work" className="xl:col-span-8 xl:min-h-0"><NoPatientSelected /></div>
          ) : (
            <>
              <PatientContainer key={`snapshot-${selectedPatient.visit_id}`} selectedPatient={selectedPatient} />
              <TriageContainer key={`triage-${selectedPatient.visit_id}`} selectedPatient={selectedPatient} />
            </>
          )}
        </div>
        {selectedPatient && (
          <div data-tour="station-work">
            <DoctorsNotesContainer key={`notes-${selectedPatient.visit_id}`} patient={selectedPatient} />
          </div>
        )}
      </div>
    </StationFlowProvider>
  )
}
