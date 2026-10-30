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
import PrintDailyReferrals from "@/components/doctors-consultation/PrintDailyReferrals";

// Queue, patient snapshot and triage summary share the top row; the consultation notes take the
// full page width underneath. The page scrolls as a whole instead of fitting one screen.
const TOP_ROW = "grid grid-cols-1 gap-6 xl:h-[30rem] xl:grid-cols-12 xl:grid-rows-1";

export default function DoctorsConsultation() {
  const location = useLocationStore((state) => state.currentLocation);
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1"><SearchBar station="consultation" onSelectPatient={setSelectedPatient} /></div>
        <PrintDailyReferrals locationId={location?.id} />
      </div>
      <div className={TOP_ROW}>
        <QueuePatientPicker
          station="consultation"
          onSelectPatient={setSelectedPatient}
          selectedVisitId={selectedPatient?.visit_id}
        />
        {!selectedPatient ? (
          <div className="xl:col-span-8 xl:min-h-0"><NoPatientSelected /></div>
        ) : (
          <>
            <PatientContainer key={`snapshot-${selectedPatient.visit_id}`} selectedPatient={selectedPatient} />
            <TriageContainer key={`triage-${selectedPatient.visit_id}`} selectedPatient={selectedPatient} />
          </>
        )}
      </div>
      {selectedPatient && (
        <DoctorsNotesContainer key={`notes-${selectedPatient.visit_id}`} patient={selectedPatient} />
      )}
    </div>
  )
}
