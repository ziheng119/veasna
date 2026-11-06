"use client"

import SearchBar from "@/components/shared/SearchBar";
import PatientDetails from "@/components/shared/read-only/patient-container/PatientDetails";
import { QueuedPatient } from "@/lib/types/patient";
import { useEffect, useState } from "react";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import { TriageTabs } from "@/components/triage/TriageTabs";
import TbFlagPanel from "@/components/triage/TbFlagPanel";
import { useLocationStore } from "@/stores/useLocationStore";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";
import { PageCard } from "@/components/shared/PageCard";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";
import { StationId } from "@/constants/stations";
import { StationFlowProvider } from "@/components/shared/StationFlow";
import StationDataButton from "@/components/shared/StationDataButton";

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

  // Triage flagged suspected TB. That sends the patient to Consult, so they leave this queue;
  // otherwise only the red TB marker changes.
  const handleTbFlagged = (currentStation: StationId | null) => {
    setSelectedPatient((prev) => prev && (currentStation && currentStation !== "triage" ? null : { ...prev, tb_flagged: true }));
    setQueueVersion((version) => version + 1);
  };

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);


    return (
      <StationFlowProvider station="triage" onSelectPatient={setSelectedPatient}>
        <div className={PAGE_SHELL}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1"><SearchBar station="triage" onSelectPatient={setSelectedPatient} /></div>
            <StationDataButton station="triage" />
          </div>
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
              ) : (
                <div className={PANEL_GRID}>
                  <PageCard
                    title="Patient Details"
                    className="xl:col-span-4"
                    contentClassName="space-y-4"
                  >
                    <PatientDetails patient={selectedPatient} />
                  </PageCard>
                  <div className={`${PANEL_WRAPPER} flex flex-col xl:col-span-8`}>
                    <TbFlagPanel
                      key={`tb-${selectedPatient.visit_id}`}
                      visitId={selectedPatient.visit_id}
                      onFlagged={handleTbFlagged}
                    />
                    <div className="min-h-0 flex-1">
                      <TriageTabs patient={selectedPatient} patient_id={selectedPatient.patient_id!}
                        key={selectedPatient.visit_id}
                        visit_id={selectedPatient.visit_id}
                        stations={selectedPatient.stations}
                        onStationsChanged={handleStationsChanged}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </StationFlowProvider>
    )
}