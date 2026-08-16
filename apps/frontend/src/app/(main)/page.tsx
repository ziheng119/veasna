"use client";
import { useUserStore } from "@/stores/useUserStore";
import { useLocationStore } from "@/stores/useLocationStore";

import { PatientQueue } from "@/components/home/PatientQueue";
import { PatientForm } from "@/components/home/PatientForm";
import { useEffect, useRef, useState } from "react";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";
import { getPatientsByLocation } from "@/lib/api/patients/getPatientsByLocation";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { getQueue } from "@/lib/api/queue/getQueue";
import { completeQueueVisit } from "@/lib/api/queue/completeQueueVisit";

export default function HomePage() {
  const token = useUserStore((state) => state.user?.token);
  const location = useLocationStore((state) => state.currentLocation);

  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [queuePatients, setQueuePatients] = useState<QueuedPatient[]>([]);
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

  // API helper functions
  async function refreshAllPatients() {
    if (token && location) {
      try {
        const db_patients = await getPatientsByLocation(location.id, token);
        setPatients(db_patients);
      } catch (err) {
        console.error("Failed to fetch patients:", err);
        toast.error("Failed to load patients");
      }
    }
  }

  async function refreshQueuePatients() {
    if (token && location) {
      try {
        const date = new Date().toISOString().slice(0, 10);
        const db_patients = await getQueue(location.id, date.toString(), token);
        setQueuePatients(db_patients);
      } catch (err) {
        console.error("Failed to fetch queue:", err);
        toast.error("Failed to load queue");
      }
    }
  }

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

  // API useEffects
  useEffect(() => {
    if (token && location) {
      refreshAllPatients();
      refreshQueuePatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, token]);

  return (
    <div className="space-y-5">
      <main className="w-full">
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4 2xl:col-span-3">
            <PatientQueue patients={queuePatients} onRemovePatient={handleRemoveFromQueue} />
          </div>
          <div className="xl:col-span-8 2xl:col-span-9">
            <PatientForm
              existingPatients={patients}
              onSubmit={refreshQueuePatients}
              locationId={location?.id}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
