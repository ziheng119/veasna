import { create } from "zustand";

type ConnectionStatus = "connecting" | "live" | "offline";

// Visits saved elsewhere since the last notice: their ids, or null when any visit may have changed
// (a save that names no visit, or a reconnect after missed notices).
export type VisitChanges = { seq: number; visitIds: number[] | null };

export const useRealtimeStore = create<{
  revision: number;
  status: ConnectionStatus;
  visitChanges: VisitChanges;
  invalidate: () => void;
  noteVisitChanges: (visitIds: number[] | null) => void;
  setStatus: (status: ConnectionStatus) => void;
}>((set) => ({
  revision: 0,
  status: "connecting",
  visitChanges: { seq: 0, visitIds: [] },
  invalidate: () => set(state => ({ revision: state.revision + 1 })),
  noteVisitChanges: (visitIds) => set(state => ({ visitChanges: { seq: state.visitChanges.seq + 1, visitIds } })),
  setStatus: (status) => set({ status }),
}));
