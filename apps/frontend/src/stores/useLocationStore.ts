import { Location } from "@/lib/types/location";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createLocation } from "@/lib/api/location/createLocation";
import { deleteLocation } from "@/lib/api/location/deleteLocation";
import { hostNow, nextHostHour } from "@/stores/useHostClockStore";

// The chosen location is forgotten at 6 am on the host's clock, the start of a new clinic day.
// The host's, not this device's: a tablet whose clock is hours or days out would otherwise keep a
// stale location, or lose it mid-clinic. The expiry is stored as a time on the host's clock.
const RESET_HOUR = 6;

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

          try {
            const data = JSON.parse(str);

            if (hostNow().getTime() > data.expiry) {
              localStorage.removeItem(name);
              return null;
            }

            return data.value;
          } catch {
            localStorage.removeItem(name);
            return null;
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(
            name,
            JSON.stringify({
              value,
              expiry: nextHostHour(RESET_HOUR),
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
