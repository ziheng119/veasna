"use client"

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import PatientContainer from "@/components/shared/read-only/patient-container/PatientContainer";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";
import SearchBar from "@/components/shared/SearchBar";
import TbReviewContainer from "@/components/tb/TbReviewContainer";
import { TbDecision } from "@/lib/api/tb/tb";
import { QueuedPatient } from "@/lib/types/patient";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import { useLocationStore } from "@/stores/useLocationStore";
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";

// Patients flagged for suspected TB wait here, isolated, until a TB doctor clears them.
export default function TbTent() {
  const location = useLocationStore((state) => state.currentLocation);
  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);
  const [queueVersion, setQueueVersion] = useState(0);

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);

  const handleDecided = (decision: TbDecision) => {
    setSelectedPatient((prev) => (decision === "cleared" ? null : prev && { ...prev, tb_status: decision }));
    setQueueVersion((version) => version + 1);
  };

  return (
    <div className={PAGE_SHELL}>
      <SearchBar station="tb" onSelectPatient={setSelectedPatient} />
      <div className={PANEL_GRID}>
        <QueuePatientPicker
          station="tb"
          onSelectPatient={setSelectedPatient}
          selectedVisitId={selectedPatient?.visit_id}
          refreshKey={queueVersion}
        />
        <div className={`${PANEL_WRAPPER} xl:col-span-8`}>
          {!selectedPatient ? (
            <NoPatientSelected />
          ) : (
            <div className={PANEL_GRID}>
              <PatientContainer selectedPatient={selectedPatient} />
              <TbReviewContainer
                key={selectedPatient.visit_id}
                patient={selectedPatient}
                onDecided={handleDecided}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
