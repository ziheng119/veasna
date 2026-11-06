import { create } from "zustand";
import defaults from "../../../../shared/formOptions.json";
import conditions from "../../../../shared/consultationConditions.json";
import { getFormOptions } from "@/lib/api/formOptions/formOptions";
import type { FormOption, FormOptionKey, FormOptionList } from "@/lib/types/formOptions";

// Built-in choices, shared with the backend. Forms show these until the saved lists have loaded,
// or if the host can't be reached.
export const DEFAULT_FORM_OPTIONS: Record<FormOptionKey, FormOption[]> = {
  snellen: defaults.snellen,
  tb_red_flags: defaults.tb_red_flags,
  referral_destinations: defaults.referral_destinations,
  consultation_conditions: conditions,
};

const builtIn = (items: FormOption[]): FormOptionList => ({ items, customized: false, last_updated_at: null, last_updated_by: null });

interface FormOptionsState {
  lists: Record<FormOptionKey, FormOptionList>;
  loaded: boolean;
  /** Reloads every list from the host; keeps the current lists if that fails. */
  load: () => Promise<void>;
  setList: (key: FormOptionKey, list: FormOptionList) => void;
}

export const useFormOptionsStore = create<FormOptionsState>()((set) => ({
  lists: {
    snellen: builtIn(DEFAULT_FORM_OPTIONS.snellen),
    tb_red_flags: builtIn(DEFAULT_FORM_OPTIONS.tb_red_flags),
    referral_destinations: builtIn(DEFAULT_FORM_OPTIONS.referral_destinations),
    consultation_conditions: builtIn(DEFAULT_FORM_OPTIONS.consultation_conditions),
  },
  loaded: false,
  load: async () => {
    try {
      const lists = await getFormOptions();
      set(state => ({ lists: { ...state.lists, ...lists }, loaded: true }));
    } catch (error) {
      console.error("Failed to load form choices:", error);
    }
  },
  setList: (key, list) => set(state => ({ lists: { ...state.lists, [key]: list } })),
}));

/** The current choices for one form list. */
export function useFormOptions(key: FormOptionKey): FormOption[] {
  return useFormOptionsStore(state => state.lists[key].items);
}
