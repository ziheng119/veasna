"use client"

import SevaNotesContainer from "@/components/seva/SevaNotesContainer";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import PatientContainer from "@/components/shared/read-only/patient-container/PatientContainer";
import TriageContainer from "@/components/shared/read-only/triage-container/TriageContainer";
import SearchBar from "@/components/shared/SearchBar";
import { QueuedPatient } from "@/lib/types/patient";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import { useLocationStore } from "@/stores/useLocationStore";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";

export default function Seva() {
    const location = useLocationStore((state) => state.currentLocation)
    
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
                    <SevaNotesContainer patient={selectedPatient}/>
                  </div>
                )}
              </div>
            </div>
        </div>
    )
}