"use client";
import { useUserStore } from "@/stores/useUserStore";
import { useLocationStore } from "@/stores/useLocationStore";

import { PatientQueue } from "@/components/home/PatientQueue";
import { PatientForm } from "@/components/home/PatientForm";
import { useCallback, useEffect, useRef } from "react";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";
import { getPatientsByLocation } from "@/lib/api/patients/getPatientsByLocation";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { getQueue } from "@/lib/api/queue/getQueue";
import { completeQueueVisit } from "@/lib/api/queue/completeQueueVisit";
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";

import { useLiveList } from "@/hooks/useLiveList";

export default function HomePage() {
  const token = useUserStore((state) => state.user?.token);
  const location = useLocationStore((state) => state.currentLocation);

  const locationId = location?.id;
  const loadPatients = useCallback(async (signal: AbortSignal): Promise<PatientInfo[]> => {
    if (!token || !locationId) return [];
    return getPatientsByLocation(locationId, token, undefined, signal);
  }, [token, locationId]);
  const loadQueue = useCallback(async (signal: AbortSignal): Promise<QueuedPatient[]> => {
    if (!token || !locationId) return [];
    return getQueue(locationId, new Date().toISOString().slice(0, 10), token, undefined, signal);
  }, [token, locationId]);
  const { data: patients, refresh: refreshAllPatients } = useLiveList(loadPatients);
  const { data: queuePatients, refresh: refreshQueuePatients } = useLiveList(loadQueue);
  const hasShownLocationToast = useRef(false);

  useEffect(() => {
    if (!location && !hasShownLocationToast.current) {
      hasShownLocationToast.current = true;
      toast(SET_LOCATION_MESSAGE);
    }
    if (location) {
      hasShownLocationToast.current = false;
    }
  }, [location]);

  async function handleRemoveFromQueue(visitId: number) {
    if (!token) return;
    try {
      await completeQueueVisit(visitId, token);
      await refreshQueuePatients();
    } catch (err) {
      console.error("Failed to remove patient from queue:", err);
      toast.error("Failed to remove patient from queue");
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <div className={PANEL_GRID}>
        <div className={`${PANEL_WRAPPER} xl:col-span-4 2xl:col-span-3`}>
          <PatientQueue patients={queuePatients} onRemovePatient={handleRemoveFromQueue} />
        </div>
        <div id="patient-registration" className={`${PANEL_WRAPPER} xl:col-span-8 2xl:col-span-9`}>
          <PatientForm
            existingPatients={patients}
            onSubmit={() => {
              refreshQueuePatients();
              refreshAllPatients();
            }}
            locationId={location?.id}
          />
        </div>
      </div>
    </div>
  );
}
