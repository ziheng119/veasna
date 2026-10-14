"use client"

import SevaNotesContainer from "@/components/seva/SevaNotesContainer";
import SevaReferralListDialog from "@/components/seva/SevaReferralListDialog";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import TbHoldNotice from "@/components/shared/TbHoldNotice";
import PatientContainer from "@/components/shared/read-only/patient-container/PatientContainer";
import TriageContainer from "@/components/shared/read-only/triage-container/TriageContainer";
import SearchBar from "@/components/shared/SearchBar";
import { QueuedPatient } from "@/lib/types/patient";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import { useLocationStore } from "@/stores/useLocationStore";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";

export default function Seva() {
    const location = useLocationStore((state) => state.currentLocation)
    
    const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);

    useEffect(() => {
        if (!location) {
        toast(SET_LOCATION_MESSAGE);
        }
    }, [location]);

    return (
        <div className={PAGE_SHELL}>
            <div className="flex items-center gap-3">
              <SearchBar onSelectPatient={setSelectedPatient} />
              <SevaReferralListDialog />
            </div>
            <div className={PANEL_GRID}>
              <QueuePatientPicker
                station="seva"
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
                    <PatientContainer selectedPatient = {selectedPatient}/>
                    <TriageContainer selectedPatient = {selectedPatient}/>
                    <SevaNotesContainer patient={selectedPatient}/>
                  </div>
                )}
              </div>
            </div>
        </div>
    )
}