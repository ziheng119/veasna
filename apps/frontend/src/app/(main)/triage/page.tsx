"use client"

import RegistrationSummary from "@/components/shared/RegistrationSummary";
import { QueuedPatient } from "@/lib/types/patient";
import { TriageTabs } from "@/components/triage/TriageTabs";
import TbFlagPanel from "@/components/triage/TbFlagPanel";
import { StationId } from "@/constants/stations";
import { StationFlowProvider } from "@/components/shared/StationFlow";
import StationSurface from "@/components/shared/StationSurface";
import { useState } from "react";

export default function Triage() {

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



  return (
    <StationFlowProvider station="triage" onSelectPatient={setSelectedPatient}>
      <StationSurface station="triage" selectedPatient={selectedPatient} onSelectPatient={setSelectedPatient} refreshKey={queueVersion}>
        {(patient) => (
          <TriageTabs patient={patient} patient_id={patient.patient_id!}
            key={patient.visit_id}
            visit_id={patient.visit_id}
            stations={patient.stations}
            onStationsChanged={handleStationsChanged}
            context={<>
              <RegistrationSummary patient={patient} />
              <TbFlagPanel visitId={patient.visit_id} onFlagged={handleTbFlagged} />
            </>}
          />
        )}
      </StationSurface>
    </StationFlowProvider>
  );
}
