// Referral types the partner NGO station can record ("Referral needed"). They are the
// "seva_referrals" list on the Station data page (defaults in shared/formOptions.json); forms save
// the id, so a renamed type keeps matching the visits saved with it.
import type { FormOption } from "@/lib/types/formOptions";

export type SevaReferral = string;

/** The name for a saved id from the current list; an id since removed from it shows as itself. */
export function sevaReferralLabel(id: string | null | undefined, options: FormOption[]): string {
  if (!id) return "";
  return options.find((option) => option.id === id)?.label ?? id;
}

/** The list's choices, plus the saved id when it has been removed, so an older record still shows it. */
export function sevaReferralChoices(options: FormOption[], saved?: string | null): FormOption[] {
  return saved && !options.some((option) => option.id === saved) ? [...options, { id: saved, label: saved }] : options;
}
