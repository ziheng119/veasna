// Lists of choices in station forms that an admin can change on the Station data page.
export type FormOptionKey = "snellen" | "tb_red_flags" | "referral_destinations" | "consultation_conditions" | "sticker_colours";

export interface FormOption {
  id: string;
  label: string;
  // Sticker colours only: the colour shown on the patient's queue card, "#rrggbb".
  colour?: string;
}

export interface FormOptionList {
  items: FormOption[];
  // False while the built-in choices are in use.
  customized: boolean;
  last_updated_at: string | null;
  last_updated_by: string | null;
}
