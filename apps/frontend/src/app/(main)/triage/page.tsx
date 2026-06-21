"use client"

import SearchBar from "@/components/shared/SearchBar";
import PatientDetails from "@/components/shared/read-only/patient-container/PatientDetails";
import { QueuedPatient } from "@/lib/types/patient";
import { useEffect, useState } from "react";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import { TriageTabs } from "@/components/triage/TriageTabs";
import { useLocationStore } from "@/stores/useLocationStore";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";

export default function Traige() {
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
      <div className="flex justify-between">
        <div className="flex-1 mr-[30px] w-[30%]">
          <SearchBar onSelectPatient={setSelectedPatient} />
          <div className="bg-beige-default p-7 mt-[30px]">
            <PatientDetails patient={selectedPatient} />
          </div>
        </div>
        
        <div className="w-[65%]">
          <TriageTabs visit_id={selectedPatient.visit_id}/>
        </div>
      </div>
    )
}