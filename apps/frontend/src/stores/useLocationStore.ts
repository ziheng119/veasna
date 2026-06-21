import { Location } from "@/lib/types/location";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createLocation } from "@/lib/api/location/createLocation";
import { deleteLocation } from "@/lib/api/location/deleteLocation";

const getNext6AM = () => {
  const now = new Date();
  const next6am = new Date();

  next6am.setHours(6, 0, 0, 0); // today 6am

  if (now >= next6am) {
    // if it's already past 6am today → move to tomorrow 6am
    next6am.setDate(next6am.getDate() + 1);
  }

  return next6am.getTime();
};

interface LocationState {
  locations: Location[];
  currentLocation: Location | null;
  hasHydrated: boolean;
  isLoading: boolean;
  error: string | null;

  setHasHydrated: (state: boolean) => void;
  setLocations: (locations: Location[]) => void;
  setCurrentLocation: (location: Location) => void;
  addLocation: (name: string) => Promise<void>;
  removeLocation: (locationId: number) => Promise<void>;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      locations: [],
      currentLocation: null,
      hasHydrated: false,
      isLoading: false,
      error: null,

      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),
      setLocations: (locations: Location[]) => set({ locations: locations}),
      setCurrentLocation: (location: Location) => set({ currentLocation: location }),
      setError: (error: string | null) => set({ error }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      
      addLocation: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
          const newLocation = await createLocation(name);
          set((state) => ({
            locations: [...state.locations, newLocation],
            isLoading: false,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create location';
          set({ 
            error: errorMessage, 
            isLoading: false 
          });
          throw error; // Re-throw so the UI can handle it
        }
      },
      
      removeLocation: async (locationId: number) => {
        set({ isLoading: true, error: null });
        try {
          await deleteLocation(locationId);
          set((state) => {
            const filtered = state.locations.filter((loc) => loc.id !== locationId);
            const stillValid = state.currentLocation && state.currentLocation.id !== locationId;
            return {
              locations: filtered,
              currentLocation: stillValid ? state.currentLocation : filtered[0] || null,
              isLoading: false,
            };
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete location';
          set({ 
            error: errorMessage, 
            isLoading: false 
          });
          throw error; // Re-throw so the UI can handle it
        }
      }
    }),
    {
      name: "location-storage",
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;

          const data = JSON.parse(str);

          if (Date.now() > data.expiry) {
            localStorage.removeItem(name);
            return null; // expired → fallback to defaults
          }

          return data.value;
        },
        setItem: (name, value) => {
          localStorage.setItem(
            name,
            JSON.stringify({
              value,
              expiry: getNext6AM(),
            })
          );
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({
        currentLocation: state.currentLocation,
        locations: state.locations,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);
