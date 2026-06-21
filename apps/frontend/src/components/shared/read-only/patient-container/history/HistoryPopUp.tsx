"use client";

import React, { Dispatch, SetStateAction, RefObject, MouseEvent, useEffect, useState } from "react";
import HorizontalLabelInputPair from "../../../HorizontalLabelInputPair";
import { QueuedPatient } from "@/lib/types/patient";
import { getHistory } from "@/lib/api/visit/getHistory"; // Assume you have a helper to fetch history
import { MedicalHistory } from "@/lib/types/medicalHistory";
import Loading from "@/components/shared/Loading";
import NoDataAvailable from "@/components/shared/NoDataAvailable";
import { HISTORY } from "@/constants/strings";

interface History {
  past: string;
  drug_and_treatment: string;
  family: string;
  social: string;
}

interface Props {
  setShowPopUp: Dispatch<SetStateAction<boolean>>;
  popupRef: RefObject<HTMLDivElement> | null;
  pos: { x: number; y: number };
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  patient: QueuedPatient;
}

export default function HistoryPopUp({ setShowPopUp, popupRef, pos, onMouseDown, patient }: Props) {
  const [patientHistory, setPatientHistory] = useState<MedicalHistory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await getHistory(patient.patient_id, patient.visit_id);
        setPatientHistory(data);
      } catch (err) {
        console.error("Failed to fetch patient history:", err);
        setPatientHistory(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [patient]);

  return (
    <div
      className="fixed inset-0 bg-opacity-30 flex items-center justify-center z-50"
      onClick={() => setShowPopUp(false)}
    >
      <div
        ref={popupRef}
        className="p-6 rounded-lg shadow-lg relative cursor-move bg-white w-[80vw] max-h-[80vh] overflow-auto"
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
        }}
        onMouseDown={onMouseDown}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <Loading />
        ) : !patientHistory ? (
          <NoDataAvailable dataString={HISTORY} />
        ) : (
          <div className="flex flex-col gap-3">
            <HorizontalLabelInputPair
              label="Past History"
              readOnly
              value={patientHistory.past || "N/A"}
            />
            <HorizontalLabelInputPair
              label="Drug and Treatment History"
              readOnly
              value={patientHistory.drug_and_treatment || "N/A"}
            />
            <HorizontalLabelInputPair
              label="Family History"
              readOnly
              value={patientHistory.family || "N/A"}
            />
            <HorizontalLabelInputPair
              label="Social History"
              readOnly
              value={patientHistory.social || "N/A"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
