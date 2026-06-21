"use client";
import { useUserStore } from '@/stores/useUserStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useLocationDataStore } from '@/stores/useLocationDataStore';

import { PatientQueue } from '@/components/home/PatientQueue';
import { PatientForm } from '@/components/home/PatientForm';
import { useEffect, useState } from 'react';
import { SET_LOCATION_MESSAGE } from '@/messages/info';
import toast from 'react-hot-toast';
import { getPatientsByLocation } from '@/lib/api/patients/getPatientsByLocation';
import { PatientInfo, QueuedPatient } from '@/lib/types/patient';
import { getQueue } from '@/lib/api/queue/getQueue';

export default function HomePage() {
  const user = useUserStore((state) => state.user);
  const token = useUserStore((state) => state.user?.token);
  const username = user?.username;
  const location = useLocationStore((state) => state.currentLocation);

  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [queuePatients, setQueuePatients] = useState<QueuedPatient[]>([]);

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);
  
  // API helper functions
  async function refreshAllPatients() {
    if (token && location) {
      const db_patients = await getPatientsByLocation(location.id,  token);
      setPatients(db_patients);
    }
  }

  async function refreshQueuePatients() {
    if (token && location) {
      const date = new Date().toISOString().slice(0, 10);
      const db_patients = await getQueue(location.id, date.toString(), token);
      setQueuePatients(db_patients);
    }
  }

  // API useEffects
  useEffect(() => {
    if (token && location) {
      refreshAllPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  useEffect(() => {
    refreshQueuePatients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <div className="min-h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header with gradient */}
      <header className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-2">
          <div className="flex items-center justify-between">
              <h1 className="text-2xl text-black font-bold">
                Welcome, {username} !
              </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-hidden bg-background w-full">
        <div className="flex w-full gap-6">
          <div className="w-1/3 min-w-[300px]">
            <PatientQueue 
              patients={queuePatients}
            />
          </div>
          <div className="flex-1 min-w-[600px] flex">
            <PatientForm
              existingPatients={patients}
              onSubmit={refreshQueuePatients}
              locationId={location?.id}
            />
          </div>
        </div>
      </main>
    </div>
  )
}