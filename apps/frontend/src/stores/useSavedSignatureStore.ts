import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Signature } from "@/lib/types/consultation";

// A signature the signed-in user chose to reuse on the referrals they write next. Kept for this
// browser tab only (sessionStorage, so it survives a reload but not closing the tab), never sent to
// the backend, and forgotten on sign-out.
interface SavedSignatureState {
  userId: number | null;
  signature: Signature | null;
  save: (userId: number, signature: Signature) => void;
  forget: () => void;
}

export const useSavedSignatureStore = create<SavedSignatureState>()(
  persist(
    (set) => ({
      userId: null,
      signature: null,
      save: (userId, signature) => set({ userId, signature }),
      forget: () => set({ userId: null, signature: null }),
    }),
    { name: "saved-signature", storage: createJSONStorage(() => sessionStorage) },
  ),
);
