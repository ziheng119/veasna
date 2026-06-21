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

export default function DoctorsConsultation() {
  const location = useLocationStore((state) => state.currentLocation);
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);

  if (!selectedPatient) {
      return (
      <div className="flex flex-col w-full h-screen gap-y-5">
          <SearchBar onSelectPatient={setSelectedPatient} />
          <NoPatientSelected/>
      </div>
      );
  }

  return (
    <div className="flex flex-col gap-2 lg:min-h-[70vh]">
      <SearchBar onSelectPatient={setSelectedPatient} />
      <div className="flex flex-col gap-2 mt-3 lg:w-full lg:flex-row lg:gap-4 lg:justify-evenly">
        <PatientContainer selectedPatient = {selectedPatient}/>
        <TriageContainer selectedPatient = {selectedPatient}/>
        <DoctorsNotesContainer patient={selectedPatient} />
      </div>
    </div>
  )
}