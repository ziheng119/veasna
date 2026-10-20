import { create } from "zustand";

type ConnectionStatus = "connecting" | "live" | "offline";

export const useRealtimeStore = create<{
  revision: number;
  status: ConnectionStatus;
  invalidate: () => void;
  setStatus: (status: ConnectionStatus) => void;
}>((set) => ({
  revision: 0,
  status: "connecting",
  invalidate: () => set(state => ({ revision: state.revision + 1 })),
  setStatus: (status) => set({ status }),
}));
