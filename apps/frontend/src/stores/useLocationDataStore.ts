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
  fetchData: () => Promise<void>;
}

export const useLocationDataStore = create<LocationDataStore>((set, get) => ({
  all_patients: [],
  todays_patients: [],
  drugs: [],
  fetchData: async () => {
    try {
      const locationId = useLocationStore.getState().currentLocation?.id;
      if (!locationId) throw new Error("No current location selected")

      const token = useUserStore.getState().user?.token; 
      if (!token) throw new Error("No auth token available");

      const today = new Date().toISOString().slice(0, 10)
      
      const [patients, today_patients, pharmacy] = await Promise.all([
        getPatientsByLocation(locationId, token),
        getQueue(locationId, today.toString(), token),
        getDrugsByLocation(locationId),
      ]);
      set({ all_patients: patients, todays_patients: today_patients, drugs: pharmacy });

      console.log("All Patients:", patients)
      console.log("Today's Patients:", today_patients)
      console.log("All Drugs:", pharmacy)
    } catch (err) {
      console.error("Failed to fetch location data:", err);
    }
  },
}));
