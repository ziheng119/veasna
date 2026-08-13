import { create } from "zustand";
import { useUserStore } from "./useUserStore";
import { getPatientsByLocation } from "@/lib/api/patients/getPatientsByLocation";
import { getDrugsByLocation } from "@/lib/api/pharmacy/pharmacy";
import { useLocationStore } from "./useLocationStore";
import { getQueue } from "@/lib/api/queue/getQueue";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { Drug } from "@/lib/types/drug";

interface LocationDataStore {
  all_patients: PatientInfo[];
  todays_patients: QueuedPatient[];
  drugs: Drug[];
  error: string | null;
  fetchData: () => Promise<void>;
}

export const useLocationDataStore = create<LocationDataStore>((set, get) => ({
  all_patients: [],
  todays_patients: [],
  drugs: [],
  error: null,
  fetchData: async () => {
    try {
      const locationId = useLocationStore.getState().currentLocation?.id;
      if (!locationId) throw new Error("No current location selected")

      const token = useUserStore.getState().user?.token;
      if (!token) throw new Error("No auth token available");

      const today = new Date().toISOString().slice(0, 10)

      const results = await Promise.allSettled([
        getPatientsByLocation(locationId, token),
        getQueue(locationId, today.toString(), token),
        getDrugsByLocation(locationId),
      ]);

      const patients = results[0].status === 'fulfilled' ? results[0].value : get().all_patients;
      const today_patients = results[1].status === 'fulfilled' ? results[1].value : get().todays_patients;
      const pharmacy = results[2].status === 'fulfilled' ? results[2].value : get().drugs;

      const failures = results.filter(r => r.status === 'rejected');
      const error = failures.length > 0
        ? `Failed to fetch ${failures.length} data source(s)`
        : null;

      set({ all_patients: patients, todays_patients: today_patients, drugs: pharmacy, error });

      if (failures.length > 0) {
        console.error("Partial fetch failures:", failures.map(f => (f as PromiseRejectedResult).reason));
      }
    } catch (err) {
      console.error("Failed to fetch location data:", err);
      set({ error: String(err) });
    }
  },
}));
