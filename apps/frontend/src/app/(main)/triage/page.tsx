"use client"

import SearchBar from "@/components/shared/SearchBar";
import PatientDetails from "@/components/shared/read-only/patient-container/PatientDetails";
import { QueuedPatient } from "@/lib/types/patient";
import { useEffect, useState } from "react";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import TbHoldNotice from "@/components/shared/TbHoldNotice";
import { TriageTabs } from "@/components/triage/TriageTabs";
import { useLocationStore } from "@/stores/useLocationStore";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";
import { PageCard } from "@/components/shared/PageCard";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";
import { StationId } from "@/constants/stations";

export default function Traige() {
  const location = useLocationStore((state) => state.currentLocation);

  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);
  const [queueVersion, setQueueVersion] = useState(0);

  // Triage changed which stations the selected patient still has to visit.
  const handleStationsChanged = (remaining: StationId[]) => {
    setSelectedPatient((prev) => prev && {
      ...prev,
      stations: [
        ...(prev.stations ?? []).filter((s) => s.completed),
        ...remaining.map((station) => ({ station, completed: false })),
      ],
    });
    setQueueVersion((version) => version + 1);
  };

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
            station="triage"
            onSelectPatient={setSelectedPatient}
            selectedVisitId={selectedPatient?.visit_id}
            refreshKey={queueVersion}
          />
          <div className={`${PANEL_WRAPPER} xl:col-span-8`}>
            {!selectedPatient ? (
              <NoPatientSelected />
            ) : selectedPatient.current_station === "tb" ? (
              <TbHoldNotice patient={selectedPatient} />
            ) : (
              <div className={PANEL_GRID}>
                <PageCard
                  title="Patient Details"
                  className="xl:col-span-4"
                  contentClassName="space-y-4"
                >
                  <PatientDetails patient={selectedPatient} />
                </PageCard>
                <div className={`${PANEL_WRAPPER} xl:col-span-8`}>
                  <TriageTabs
                    key={selectedPatient.visit_id}
                    visit_id={selectedPatient.visit_id}
                    stations={selectedPatient.stations}
                    onStationsChanged={handleStationsChanged}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
}