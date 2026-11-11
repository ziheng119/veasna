# Accounts and permissions

Veasna has one fixed sign-in, the admin, plus the screening-day accounts that the admin
creates for everyone else:

| Account | Password | Sees |
| --- | --- | --- |
| `admin` | `admin12345` | Everything |
| Screening-day account, e.g. `dec13village` | chosen by the admin, e.g. `ilovebtb` | Only patients queued on its screening day, and their earlier visits (from **Past visits** on their queue card) |

The old shared `user` / `user` sign-in has been retired: it is disabled when the server
starts. It is kept, not deleted, so the records it entered still show who entered them.

## Screening-day accounts

Make one account per screening day and hand it to everyone working that day. Everyone
shares it.

1. Sign in as `admin`, open the user menu and choose **Accounts**.
2. Under **New screening-day account**, type the username (e.g. `dec13village`), the
   password (e.g. `ilovebtb`) and the screening date (e.g. 13 December), then press
   **Create**.

The account then:

- **Sees only that day's patients.** Patient List, every queue and the pharmacy show
  only patients queued on its screening date, so patient data stays limited to the
  villagers who come that day. A patient who came on an earlier trip shows
  **Past visits (n)** under their card in each station queue; it opens their record with
  every earlier visit, and **Back to queue** returns to them. Patients from other trips or
  days who aren't queued that day can't be opened. **View** on the Patient List is for
  the admin only.
- **Can find returning patients to queue them.** On Home, typing 3 or more letters of a
  name lists matching earlier patients (name, date of birth, sex, phone, address, ID
  only, no clinical records), so their new visit joins their existing record.
- **Saves only on its screening day, and only to that day's visits.** Earlier visits
  are read-only: Patient Details shows them without **Edit** or **Add**, with a line
  saying only the admin can change them. The patient's own details (name, phone and so
  on) can still be corrected. On another day it can still sign in and look, but every save is
  refused with a message naming its date. The host laptop's clock decides what "today"
  is, so check it before the clinic opens.
- It enters records and corrects saved ones for that day's visits, but can't print
  referrals, download patient data or delete anything.

On the **Accounts** page the admin can change an account's date or password, disable
or enable it, or remove it. An account that entered any records is disabled instead of
removed, so the records still show who entered them.

## What each account can do

| Action | Screening day | Admin |
| --- | --- | --- |
| View and search pages, queues and the records of the day's patients, with their earlier visits (**Past visits** on the queue card) | Yes | Yes |
| Open any patient's record from the Patient List (**View**), including patients not queued that day | No | Yes |
| Open **Analytics** | No | Yes |
| Print a referral (**Save & print referral**), or referrals for a day, a period or every date at once | No | Yes |
| **Download all patient data** (Patient List) | No | Yes |
| Change the choices in station forms (**Station data**) | No | Yes |
| Create, change or remove screening-day accounts (**Accounts**) | No | Yes |
| Register a patient or start a new visit | Yes | Yes |
| Group patients into a family, or take one out (**Add to family** on Patient List) | Yes | Yes |
| Fill in a station form or triage section | Yes | Yes |
| Create, change and sign a referral | Yes | Yes |
| Change saved details: names, queue numbers, vitals, HEF, clinical notes, station forms (at the station, or on **Patient Details**) | Yes | Yes |
| Delete a patient, or one visit of a patient (**Delete visit** on the patient's record) | No | Yes |
| Delete a referral | No | Yes |
| Send a patient to the next station (**Next/Finish**), change their stations or their order (**Send to**), or discharge them | Yes | Yes |
| Change a suspected TB patient's stations (they only go to Consult) | No | No |
| Add a new medicine to the pharmacy | Yes | Yes |
| Prescribe from the pharmacy (reserves the stock) | Yes | Yes |
| Change stock, rename or delete a medicine, dispense, or cancel a prescription | No | Yes |
| Flag a patient for suspected TB, or clear the flag at Consult after a doctor has seen them | Yes | Yes |
| Change a TB flag's red flags or notes | Yes | Yes |
| Add or remove clinic locations | No | Yes |

## What a patient's record shows

**Patient Details** (from **View** on the Patient List for the admin, or **Past visits** on a
queue card) shows the patient's details and family letter, and every visit, newest first.
Each visit in the list is marked with what it has records for: suspected TB, Triage,
Dental, Consultation, Referral, Physiotherapy, Partner NGO and the number of medicines.
Opening a visit shows:

- **Stations:** where the patient went, in order, ticked with the time each was finished,
  and whether the visit is finished or the patient is still in the clinic.
- One tab per station with everything saved there: registration (visit details, vitals,
  HEF), triage, consultation notes and conditions, the referral (destinations, doctor,
  signer), physiotherapy (notes and body chart), dental, partner NGO and the TB flag.
- **Pharmacy:** each medicine prescribed, its quantity and instructions, and whether it
  was dispensed, cancelled or is still waiting, with who did each and when. Prescriptions
  are read-only here; they are made at Consult and dispensed at Pharmacy.

## Changing saved records

- Every form can be saved again after its first save: each triage section, consultation
  notes, partner NGO notes, physiotherapy, dental notes and the referral. Doctors often
  find more as the patient moves through the stations, so anyone signed in can add it.
- **Patient Details** lets anyone correct the patient's details and the records of the
  day's visit, one section at a time. Earlier visits are read-only except for the admin,
  who can change any visit. Only the admin sees **Delete visit**. The visit list says
  which visits the account may change (`editable`, from `saveScope` in
  `utils/dayScope.js`, the same rule the server enforces on save).
- Each save records the account and time in `last_updated_by` and `last_updated_at`.
  Everyone on a screening day shares one account, so the record shows that account.
- If two people save the same form at the same moment, both saves succeed and the later
  one is kept, as with any edit. There is still only one record per form and visit.
- **A save shows on every device with the same patient open.** When a form is saved
  (for example the consultation notes), the same form open for that patient on other
  devices updates too:
  - If nothing was typed there since it was opened or saved, it shows the new version
    with a short note, "Updated with a save from another device".
  - If something was typed there, it is kept. A notice says the form was saved on
    another device and offers **Show saved version** or **Keep mine**. Saving keeps
    whichever version is saved last.
  - Triage names the section that changed. The referral dialog updates its fields but
    never its signature box: a signature belongs to whoever signs on that device. The
    signature a doctor keeps for their next referrals stays in their own browser tab
    and is never shared.
  - Read-only panels (vitals, triage summary, dental notes at Consult) update quietly.
  (`components/shared/LiveRecord.tsx`; the server names the saved visit in its live
  notice, `apps/backend/realtime.js`.)
- **Unsaved typing is kept on the device.** On the Triage, Dental, Consult notes,
  Physiotherapy and partner NGO forms, anything typed and not yet saved is kept in that
  browser as a draft, for that account, visit and form. If the Wi-Fi drops, the device is
  signed out, the page reloads or someone opens another patient, opening the form again
  puts it back with the note "Put back what you typed earlier on this device. It isn't
  saved yet." and a **Discard** button. If the form was saved on another device in the
  meantime, the draft is not put back over that save: a notice offers **Put mine back**
  or **Discard**. Saving removes the draft; drafts older than a day are deleted. Another
  account signing in on the same device doesn't see them. The registration form and the
  referral dialog don't keep drafts. (`lib/drafts.ts`.)
- Each prescription is its own record, so doctors can still prescribe after their
  consultation notes are saved. Cancelling or dispensing one stays with the admin, since
  it changes stock.
- Re-drawing a referral's signature records whoever saved it as the signer. An unchanged
  signature keeps its original signer.

## Resetting the fixed accounts

From the project folder:

```bash
npm run setup:accounts --workspace apps/backend
```

This resets the `admin` password and role above and disables every other sign-in
(including the old `user` account) except screening-day accounts, which are left as they
are. Old accounts are
kept so earlier records still show who entered them, but they can no longer sign in.
No clinical records are changed. `npm run setup:backend` does the same as part of
first-time setup. It never runs on its own when the server starts.

## Technical details

- The server checks the account, role and screening date on every request, so a
  disabled account or a changed date takes effect immediately, even with an old sign-in.
- Every account except the admin is limited to one day's patients: a screening-day
  account to its screening date, any other non-admin account to the host's clinic day
  (`scopeDate` in `utils/dayScope.js`, set as `req.user.scope_date` by
  `middleware/authorizeApi.js`).
- A screening-day account has the `user` role and `users.screening_date` set
  (migration `020_day_accounts_form_options.sql`). `utils/dayScope.js` limits it: lists
  filter by that date in their queries, and a request for one patient or visit is
  checked before it reaches its route. Reading needs the patient to have a visit on
  that date; saving needs the visit itself to be on that date, and the host's date to
  be the screening date. Correcting a patient's details needs them to be queued that
  day, and a visit can't be moved to another date. Requests it doesn't recognise are
  refused.
- `GET /api/patients/lookup?location_id=..&q=..` (3+ letters, 10 results, identifying
  fields only) is the one way a screening-day account sees other patients.
- Admin only: `/api/analytics`, `/api/accounts`, `/api/export/patients`,
  `GET /api/visits/referrals` (bulk printing), `DELETE /api/visits/:id` and every
  change to `/api/form-options`.
- Other accounts are allowed a fixed list of save requests (station forms, triage,
  referral, registration, TB flag, prescribing, families), the record corrections on
  Patient Details (`PUT patient/{id}`, `PUT visits/{id}`, `PUT visits/{id}/vitals`,
  `PUT visits/{id}/tb`), and moving patients between stations
  (`POST queue/{id}/stations/{station}/complete`, `PUT queue/{id}/stations`,
  `PUT queue/{id}/stations/{station}`, `POST queue/{id}/complete`). Everything else
  (DELETE, PATCH, pharmacy stock and dispensing, older edit addresses and admin requests)
  is refused (`utils/permissions.js`).
- Saving over an existing record goes through `canEditSavedRecords` in
  `utils/permissions.js`, used in each save's `ON CONFLICT ... WHERE`, so an unknown role
  still can't change a saved record.
- Printing happens in the browser, so the app shows **Save & print referral** and
  **Print referrals** to the admin only, and the server refuses other accounts the bulk
  referral list (`GET visits/referrals`) and the patient download.
- The shared `user` sign-in is disabled at start-up by
  `migrations/022_retire_shared_user_account.sql` (only an account named `user` with no
  screening date).
- `last_updated_by` and timestamps change only when a save is allowed and succeeds.
  Everyone on a screening day shares one account, so records show that account, not
  the individual volunteer.
- `POST /api/auth/register` and `POST /api/users` always refuse account creation;
  accounts are created only through `POST /api/accounts`.
- `npm run seed:admin` and `npm run seed:stations` are older names for the same
  account setup.

Tests (database tests use temporary tables only):

```powershell
npm test --workspace apps/frontend
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand permissions.test.js stationUsers.database.test.js savedRecords.database.test.js referral.database.test.js analytics.database.test.js dayAccounts.database.test.js visitEdits.database.test.js tbFlow.database.test.js
```
