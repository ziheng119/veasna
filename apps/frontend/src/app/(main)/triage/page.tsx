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
import { PageCard } from "@/components/shared/PageCard";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";

export default function Traige() {
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
                <PageCard
                  title="Patient Details"
                  className="xl:col-span-4"
                  contentClassName="space-y-4"
                >
                  <PatientDetails patient={selectedPatient} />
                </PageCard>
                <div className="xl:col-span-8">
                  <TriageTabs visit_id={selectedPatient.visit_id}/>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
}