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

export default function DoctorsConsultation() {
  const location = useLocationStore((state) => state.currentLocation);
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);

  return (
    <div className="space-y-5">
      <SearchBar onSelectPatient={setSelectedPatient} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <QueuePatientPicker
          onSelectPatient={setSelectedPatient}
          selectedVisitId={selectedPatient?.visit_id}
        />
        <div className="xl:col-span-8">
          {!selectedPatient ? (
            <NoPatientSelected />
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
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