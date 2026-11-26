# Station data

The admin can change the choices offered in the station forms, for example the
Snellen readings (20/20, 20/40, ...) for each eye at Triage. Open it from the user menu
(**Station data**).

| List | Used in |
| --- | --- |
| Sticker colours | Registration (**Patient Info**): the colour of the sticker given to the patient, shown as a small tag on their queue number in every queue |
| Visual acuity (Snellen) readings | Triage and Partner NGO: readings without pinhole, with pinhole and with glasses, both eyes |
| TB red flags | Registration and Triage (3 or more flag suspected TB) |
| Conditions addressed | Consult notes, and the condition charts on Analytics |
| Referral destinations | Consult referrals (printed on the letter): places patients go outside the screening on referral days |
| Doctors on referral letters | Consult referrals: **Doctor's name**, printed under the signature |
| Referral types | Partner NGO form (**Referral needed**), its **Referral list** pop-up, and **Partner NGO referrals** on Analytics. Built in: Cataract surgery, Partner NGO (general) |

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
- Snellen readings must be fractions such as `20/15`. The built-in list is 20/20, 20/25,
  20/30, 20/40, 20/50, 20/60, 20/70, 20/100 and 20/200. A host whose admin had already saved
  its own Snellen list keeps it; press **Restore built-in choices** to switch to this one.
- Each sticker colour has a swatch: click it to pick the colour shown in the queues.
  Renaming a colour keeps its internal id, so patients already given that sticker keep it.
  A removed colour still shows (in grey) on visits that were given it.
- Renaming a Partner NGO referral type keeps its internal id, so patients already
  referred stay under the new name. A removed type still shows on the visits saved with
  it, in the Referral list and on Analytics (after the listed types).
- Medicines are edited on the Pharmacy dashboard; accounts and their permissions on
  **Accounts**.

## Technical details

- Lists are stored in the `form_options` table (one JSON row per list, with
  `last_updated_by` and `last_updated_at`); a list with no row uses
  `shared/formOptions.json` or `shared/consultationConditions.json`
  (`apps/backend/utils/formOptions.js`, migration `020_day_accounts_form_options.sql`).
- `GET /api/form-options` (every account); `PUT /api/form-options/:key` with
  `{ items: [{ id, label }] }` (sticker colours: `{ id, label, colour: "#rrggbb" }`) and
  `DELETE /api/form-options/:key` (admin only).
- A visit's sticker is `visits.sticker_colour` (migration `021_glasses_sticker_colour.sql`),
  the id of a sticker colour. It is checked against the current list when saved.
- Saving consultation conditions checks the ids against the current list.
- `seva.referral` is the id of a Partner NGO referral type (list `seva_referrals`). Saving
  checks it against the current list, or the type the visit was already saved with.
  Migration `031_editable_seva_referrals.sql` removed the old fixed check on the column.
