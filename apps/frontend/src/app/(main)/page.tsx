"use client";
import { useUserStore } from "@/stores/useUserStore";

import { PatientQueue } from "@/components/home/PatientQueue";
import { PatientForm } from "@/components/home/PatientForm";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { getPatientList } from "@/lib/api/patients/getPatientList";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { getQueue, CLINIC_TODAY } from "@/lib/api/queue/getQueue";
import { completeQueueVisit } from "@/lib/api/queue/completeQueueVisit";
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";
import { can } from "@/lib/permissions";
import { PageCard } from "@/components/shared/PageCard";
import { Lock } from "lucide-react";

import { useLiveList } from "@/hooks/useLiveList";

export default function RegistrationPage() {
  const token = useUserStore((state) => state.user?.token);
  // Registering needs "Edit today's queue"; the patient list it checks names against needs
  // "See today's patients" (without it, names are looked up on the host as they are typed).
  const canRegister = useUserStore((state) => can(state.user, "edit_today"));
  const canListPatients = useUserStore((state) => can(state.user, "view_today"));

  const loadPatients = useCallback(async (signal: AbortSignal): Promise<PatientInfo[]> => {
    if (!token || !canListPatients || !canRegister) return [];
    return getPatientList(token, undefined, signal);
  }, [token, canListPatients, canRegister]);
  const loadQueue = useCallback(async (signal: AbortSignal): Promise<QueuedPatient[]> => {
    if (!token) return [];
    return getQueue(CLINIC_TODAY, token, undefined, signal);
  }, [token]);
  const { data: patients, refresh: refreshAllPatients } = useLiveList(loadPatients);
  const { data: queuePatients, refresh: refreshQueuePatients } = useLiveList(loadQueue);

  async function handleRemoveFromQueue(visitId: number) {
    if (!token) return;
    try {
      await completeQueueVisit(visitId, token);
      await refreshQueuePatients();
    } catch (err) {
      console.error("Failed to remove patient from queue:", err);
      toast.error(err instanceof Error ? err.message : "Failed to remove patient from queue");
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <div className={PANEL_GRID}>
        <div data-tour="home-queue" className={`${PANEL_WRAPPER} xl:col-span-4 2xl:col-span-3`}>
          <PatientQueue patients={queuePatients} onRemovePatient={handleRemoveFromQueue} />
        </div>
        <div id="patient-registration" data-tour="registration" className={`${PANEL_WRAPPER} xl:col-span-8 2xl:col-span-9`}>
          {canRegister ? (
            <PatientForm
              existingPatients={patients}
              onSubmit={() => {
                refreshQueuePatients();
                refreshAllPatients();
              }}
            />
          ) : (
            <PageCard title="Registration">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p>
                  This account can see the queue but not register patients. Registering needs the
                  {" "}<span className="font-medium">Edit today&apos;s queue</span> permission; ask the admin to turn it on in Accounts.
                </p>
              </div>
            </PageCard>
          )}
        </div>
      </div>
    </div>
  );
}
