"use client";

import { useCallback, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useLiveList } from "@/hooks/useLiveList";
import { getPatientPrescriptions, getPrescriptionPatients } from "@/lib/api/pharmacy/prescriptions";
import { Prescription, PrescriptionPatient, PRESCRIPTION_STATUS_LABELS } from "@/lib/types/prescription";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<Prescription["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  dispensed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");

/** Patients with prescriptions at the location; selecting one shows everything they were given. */
export default function PatientPrescriptionHistory({ locationId }: { locationId: number }) {
  const token = useUserStore((state) => state.user?.token);
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState<number | null>(null);

  const loadPatients = useCallback(async (signal: AbortSignal): Promise<PrescriptionPatient[]> => {
    if (!token) return [];
    return getPrescriptionPatients(locationId, signal);
  }, [locationId, token]);
  const loadHistory = useCallback(async (signal: AbortSignal): Promise<Prescription[]> => {
    if (!token || !patientId) return [];
    return getPatientPrescriptions(patientId, signal);
  }, [patientId, token]);
  const { data: patients, loaded } = useLiveList(loadPatients);
  const { data: history } = useLiveList(loadHistory);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) =>
      [p.english_name, p.khmer_name, p.face_id].some((value) => value?.toLowerCase().includes(q)));
  }, [patients, search]);
  const selected = patients.find((p) => p.patient_id === patientId) ?? null;

  return (
    <div className="grid gap-0 xl:grid-cols-12">
      <div className="border-b border-border xl:col-span-4 xl:border-b-0 xl:border-r">
        <div className="p-3">
          <Input placeholder="Search patients by name or Unique ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loaded && shown.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-muted-foreground">
            {patients.length === 0 ? "No prescriptions at this location yet." : "No patient matches this search."}
          </p>
        ) : (
          <ul className="max-h-[32rem] overflow-y-auto px-2 pb-2" aria-label="Patients with prescriptions">
            {shown.map((p) => (
              <li key={p.patient_id}>
                <button
                  type="button"
                  aria-pressed={p.patient_id === patientId}
                  onClick={() => setPatientId(p.patient_id)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    p.patient_id === patientId ? "bg-primary/10 text-foreground" : "hover:bg-accent/60",
                  )}
                >
                  <span className="block font-medium">{p.english_name || "Unknown name"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[p.khmer_name, p.face_id].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {p.dispensed_count} dispensed
                    {p.pending_count > 0 && <span className="font-medium text-amber-700"> · {p.pending_count} waiting</span>}
                    {p.cancelled_count > 0 && ` · ${p.cancelled_count} cancelled`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0 xl:col-span-8">
        {!selected ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">Select a patient to see what they were prescribed and dispensed.</p>
        ) : (
          <div className="overflow-x-auto">
            <h3 className="px-4 pt-4 text-base font-semibold">{selected.english_name || "Unknown name"}</h3>
            <table className="mt-2 w-full min-w-[640px]">
              <thead className="bg-muted">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Drug</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {history.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3">{p.visit_date}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{p.drug_name}</span>
                      {p.instructions && <span className="block text-xs text-muted-foreground">{p.instructions}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{p.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONES[p.status])}>
                        {PRESCRIPTION_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <span className="block">Prescribed {dateTime(p.prescribed_at)}{p.prescribed_by && ` by ${p.prescribed_by}`}</span>
                      {p.dispensed_at && <span className="block">Dispensed {dateTime(p.dispensed_at)}{p.dispensed_by && ` by ${p.dispensed_by}`}</span>}
                      {p.cancelled_at && <span className="block">Cancelled {dateTime(p.cancelled_at)}{p.cancelled_by && ` by ${p.cancelled_by}`}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
