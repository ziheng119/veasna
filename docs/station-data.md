# Station data

The admin can change the choices offered in the station forms, for example the
Snellen readings (6/6, 6/9, ...) for each eye at Triage. Open it with **Edit station
data** at the top right of the Triage, Consult or Partner NGO page (beside the queue
search), or from the user menu (**Station data**).

| List | Used in |
| --- | --- |
| Visual acuity (Snellen) readings | Triage and Partner NGO: pinhole and no-pinhole readings, both eyes |
| TB red flags | Registration and Triage (3 or more flag suspected TB) |
| Conditions addressed | Consult notes, and the condition charts on Analytics |
| Referral destinations | Consult referrals (printed on the letter) |

For each list you can rename a choice, drag it by its grip (⋮⋮) to a new place (or focus
the grip and use the arrow keys), remove it (after confirming) or add one, then
press **Save**. Every device uses the new list from the next page it opens (or after
**Refresh**). **Restore built-in choices** goes back to the list Veasna came with.

- Records saved earlier keep the choices they were saved with. A saved reading or
  destination that is no longer listed still shows, and stays selected when the record
  is edited.
- Renaming a TB red flag or condition keeps its internal id, so earlier visits and
  Analytics still count it under the new name. A removed condition still appears on
  Analytics (under its id) for periods where it was ticked.
- Snellen readings must be fractions such as `6/7.5`.
- Partner NGO referral outcomes (cataract surgery, general) are fixed, because the
  database only accepts those two.
- Medicines are edited on the Pharmacy dashboard; locations from the location menu.

## Technical details

- Lists are stored in the `form_options` table (one JSON row per list, with
  `last_updated_by` and `last_updated_at`); a list with no row uses
  `shared/formOptions.json` or `shared/consultationConditions.json`
  (`apps/backend/utils/formOptions.js`, migration `020_day_accounts_form_options.sql`).
- `GET /api/form-options` (every account); `PUT /api/form-options/:key` with
  `{ items: [{ id, label }] }` and `DELETE /api/form-options/:key` (admin only).
- Saving consultation conditions checks the ids against the current list.
