// src/stores/useUserStore.ts
import { User } from "@/lib/types/user";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clearPatientsByLocationCache } from "@/lib/api/patients/getPatientsByLocation";
import { clearQueueCache } from "@/lib/api/queue/getQueue";
import { clearPharmacyCache } from "@/lib/api/pharmacy/pharmacy";
import { clearAllPatientCache } from "@/lib/api/patient/getPatients";

interface UserState {
  user: User | null;
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setUser: (user: User) => void;
  removeUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),
      setUser: (user: User) => set({ user }),
      removeUser: () => {
        clearPatientsByLocationCache();
        clearQueueCache();
        clearPharmacyCache();
        clearAllPatientCache();
        set({ user: null });
      },
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => localStorage),

      // Called when Zustand finishes rehydrating the store from localStorage
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);
