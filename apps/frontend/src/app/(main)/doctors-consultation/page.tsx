"use client"

import PatientContainer from "@/components/shared/read-only/patient-container/PatientContainer";
import TriageContainer from "@/components/shared/read-only/triage-container/TriageContainer";
import DoctorsNotesContainer from "@/components/doctors-consultation/DoctorsNotesContainer";
import SearchBar from "@/components/shared/SearchBar";
import { QueuedPatient } from "@/lib/types/patient";
import { useEffect, useState } from "react";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";
import { useLocationStore } from "@/stores/useLocationStore";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";

export default function DoctorsConsultation() {
  const location = useLocationStore((state) => state.currentLocation);
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);

  return (
    <div className={PAGE_SHELL}>
      <SearchBar onSelectPatient={setSelectedPatient} />
      <div className={PANEL_GRID}>
        <QueuePatientPicker
          onSelectPatient={setSelectedPatient}
          selectedVisitId={selectedPatient?.visit_id}
        />
        <div className={`${PANEL_WRAPPER} xl:col-span-8`}>
          {!selectedPatient ? (
            <NoPatientSelected />
          ) : (
            <div className={PANEL_GRID}>
              <PatientContainer selectedPatient = {selectedPatient}/>
              <TriageContainer selectedPatient = {selectedPatient}/>
              <DoctorsNotesContainer patient={selectedPatient} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}