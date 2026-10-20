"use client"

import PatientContainer from "@/components/shared/read-only/patient-container/PatientContainer";
import TriageContainer from "@/components/shared/read-only/triage-container/TriageContainer";
import DoctorsNotesContainer from "@/components/doctors-consultation/DoctorsNotesContainer";
import SearchBar from "@/components/shared/SearchBar";
import { QueuedPatient } from "@/lib/types/patient";
import { useEffect, useState } from "react";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import TbHoldNotice from "@/components/shared/TbHoldNotice";
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
          station="consultation"
          onSelectPatient={setSelectedPatient}
          selectedVisitId={selectedPatient?.visit_id}
        />
        <div className={`${PANEL_WRAPPER} xl:col-span-8`}>
          {!selectedPatient ? (
            <NoPatientSelected />
          ) : selectedPatient.current_station === "tb" ? (
            <TbHoldNotice patient={selectedPatient} />
          ) : (
            <div className={PANEL_GRID}>
              {/* Equal-height summaries share the original snapshot column. */}
              <div key={selectedPatient.visit_id} className="grid h-[40rem] min-h-0 min-w-0 grid-rows-2 gap-4 xl:col-span-4 xl:h-full">
                <PatientContainer selectedPatient={selectedPatient} compact />
                <TriageContainer selectedPatient={selectedPatient} compact />
              </div>
              <DoctorsNotesContainer key={selectedPatient.visit_id} patient={selectedPatient} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
