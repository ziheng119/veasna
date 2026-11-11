import { create } from "zustand";
import { GUIDE_STEPS } from "@/lib/guide/steps";

// The guided tour's progress (components/guide/GuideTour.tsx). Not kept across reloads.
interface GuideState {
  active: boolean;
  index: number;
  start: () => void;
  stop: () => void;
  // Past the last step, the tour ends.
  next: () => void;
  back: () => void;
}

export const useGuideStore = create<GuideState>((set) => ({
  active: false,
  index: 0,
  start: () => set({ active: true, index: 0 }),
  stop: () => set({ active: false }),
  next: () => set((state) => (state.index < GUIDE_STEPS.length - 1 ? { index: state.index + 1 } : { active: false })),
  back: () => set((state) => ({ index: Math.max(0, state.index - 1) })),
}));
