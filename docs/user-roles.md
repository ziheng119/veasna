# Accounts and permissions

Veasna has one fixed sign-in, the admin, plus the screening-day accounts that the admin
creates for everyone else. There is one clinic: every device sees the same queues,
Patient List and pharmacy. Where a screening takes place is part of its account's
username (e.g. `dec13village`).

| Account | Password | May do |
| --- | --- | --- |
| `admin` | `admin12345` | Everything |
| Screening-day account, e.g. `dec13village` | chosen by the admin, e.g. `ilovebtb` | What the admin ticked for it (below), on its screening day |

The old shared `user` / `user` sign-in has been retired: it is disabled when the server
starts. It is kept, not deleted, so the records it entered still show who entered them.

## Screening-day accounts

Make one account per screening day and hand it to everyone working that day. Everyone
shares it.

1. Sign in as `admin`, open the user menu and choose **Accounts**.
2. Under **New screening-day account**, type the username (e.g. `dec13village`), the
   password (e.g. `ilovebtb`) and the screening date (e.g. 13 December).
3. Under **This account may**, tick what it may do (below). New accounts start with
   **See today's patients** and **Edit today's queue**. Pointing at a permission shows
   what it allows. The ticks stay for the next account you make.
4. Press **Create account**.

The account then:

- **Works on its screening day.** Before its day it can sign in and look, but every save
  is refused with a message naming its date. The host laptop's clock decides what "today"
  is, so check it before the clinic opens.
- **Sees that day's patients** (with **See today's patients**): the Patient List shows
  everyone queued that day. Every queue shows that day's patients whatever is ticked. A
  patient who came on an earlier trip shows **Past visits (n)** under their card in each
  station queue; it opens their record with every earlier visit, and **Back to queue**
  returns to them. With **See past patients** it sees every patient and visit, and the
  Patient List gets its date filter back.
- **Can find returning patients to queue them.** On Registration, typing 3 or more
  letters of a name lists matching earlier patients (name, date of birth, sex, phone,
  address, ID only, no clinical records), so their new visit joins their existing record.
- **Saves to that day's visits** (with **Edit today's queue**). Earlier visits are
  read-only: Patient Details shows them without **Edit** or **Add**, with a line saying
  that changing them needs **Edit past visits**.
- **Stops working once its day is over.** At midnight on the host laptop's calendar,
  every device still signed in with it is signed out, with a message saying its screening
  has ended, and it can no longer sign in. Volunteers use the next day's account instead.
  The account is not deleted: everything it saved stays in the records under its name,
  for the admin, Analytics and downloads. The Accounts page shows it as **Day ended**;
  changing its date to today or later lets it sign in again.

On the **Accounts** page the admin can change an account's **Date**, **Password** or
**Permissions** (each in its own pop-up, which says what is wrong if a value can't be
saved), disable or enable it, or remove it. An account that entered any records is
disabled instead of removed, so the records still show who entered them. A changed
permission reaches devices signed in with the account on their next page change.

## Permissions

| Permission | Allows | Without it |
| --- | --- | --- |
| **See today's patients** (default) | The **Patient List** with everyone queued on the account's day, and opening their records from it | The Patient List tab is not shown; the account works from the station queues |
| **Edit today's queue** (default) | Registering patients, filling in and correcting station forms, the referral and Patient Details for that day's visits, prescribing, grouping families, and **Next**, **Send to** and **Discharge** | Forms are read-only; registration and the queue buttons are not shown |
| **See past patients** | Every patient and visit, on the Patient List (with its date filter) and Patient Details. Ticks **See today's patients** | Only that day's patients, and their earlier visits from **Past visits** |
| **Edit past visits** | Correcting visits from earlier days. Ticks **Edit today's queue** and **See past patients** | Earlier visits are read-only |
| **Pharmacy stock** | Adding medicines, changing stock counts and names, dispensing, and cancelling prescriptions | The pharmacy is read-only; the dispense buttons are not shown |
| **Print and download** | **Save & print referral**, **Print referrals** (Consult and Analytics) and **Download all patient data**. Without **See past patients**, only that day's patients are printed or downloaded | The print and download buttons are not shown |
| **Analytics** | The **Analytics** page, including the referral lists | Analytics is not in the menu |

Unticking a permission also unticks the ones that need it, and the pop-up says what else
changed. With nothing ticked the account can view the station queues only. The line under
the top bar lists what the signed-in account may do.

Buttons an account can't use are not shown. If a request is refused anyway (for example a
page opened from an old link, or a permission removed while the page was open), the
message names the permission to ask for, e.g. *This account doesn't have the "Analytics"
permission. Ask the admin to turn it on in Accounts.*

Always admin only, whatever is ticked: **Station data**, **Accounts**, deleting a patient,
a visit, a referral or a medicine.

## What each account can do

| Action | Screening day | Admin |
| --- | --- | --- |
| View the station queues and the records of the day's patients, with their earlier visits (**Past visits** on the queue card) | Yes | Yes |
| Open the **Patient List** and the records of the patients on it (**View**) | **See today's patients** | Yes |
| See patients from earlier days | **See past patients** | Yes |
| Open **Analytics** | **Analytics** | Yes |
| Print a referral, or referrals for a day, a period or every date at once | **Print and download** | Yes |
| **Download all patient data** (Patient List) | **Print and download** | Yes |
| Change the choices in station forms (**Station data**) | No | Yes |
| Create, change or remove screening-day accounts (**Accounts**) | No | Yes |
| Register a patient or start a new visit | **Edit today's queue** | Yes |
| Group patients into a family, or take one out (**Add to family** on Patient List) | **Edit today's queue** | Yes |
| Fill in a station form or triage section, create, change and sign a referral | **Edit today's queue** | Yes |
| Change saved details of the day's visits (names, queue numbers, vitals, HEF, clinical notes, station forms) | **Edit today's queue** | Yes |
| Change saved details of earlier visits | **Edit past visits** | Yes |
| Send a patient to the next station (**Next/Finish**), change their stations (**Send to**), or discharge them | **Edit today's queue** | Yes |
| Prescribe from the pharmacy (reserves the stock) | **Edit today's queue** | Yes |
| Add a medicine, change stock or a name, dispense, or cancel a prescription | **Pharmacy stock** | Yes |
| Flag a patient for suspected TB, or clear the flag at Consult after a doctor has seen them | **Edit today's queue** | Yes |
| Delete a patient, a visit, a referral or a medicine | No | Yes |
| Change a suspected TB patient's stations (they only go to Consult) | No | No |

## What a patient's record shows

**Patient Details** (from **View** on the Patient List, or **Past visits** on a queue card) shows the patient's details and family letter, and every visit, newest first.
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
  find more as the patient moves through the stations, so anyone with **Edit today's
  queue** can add it.
- **Patient Details** lets an account with **Edit today's queue** correct the patient's
  details and the records of the day's visit, one section at a time. Earlier visits are
  read-only without **Edit past visits**; the admin can change any visit. Only the admin
  sees **Delete visit**. The visit list says
  which visits the account may change (`editable`, from `saveScope` in
  `utils/dayScope.js`, the same rule the server enforces on save).
- Each save records the account and time in `last_updated_by` and `last_updated_at`.
  Everyone on a screening day shares one account, so the record shows that account.
- If two people save the same form for the same patient at the same moment, the first
  save is kept and the other device is told the form was saved on another device (see
  below), so neither is lost without warning. There is only one record per form and visit.
- **A form can't silently overwrite a newer save.** On the Triage, Dental, Consult notes,
  Physiotherapy and partner NGO forms and the referral dialog, a device that missed a
  save from another device (for example, its Wi-Fi dropped) has its own save refused with
  "This form was saved on another device after you opened it". The form then shows
  **Show saved version** or **Keep mine**; saving again after choosing goes through.
  Saving or deleting a referral also updates the consult notes' referral flag, and the
  device that did it carries on with the notes' new version, so its next notes save
  isn't refused. On **Patient Details**, a stale edit of the patient's details is refused
  with "These details were changed on another device after you opened them"; the saved
  details load underneath, **Cancel** shows them, and **Save** again replaces them.
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
  account signing in on the same device doesn't see them. The registration form keeps
  one draft per account, put back the same way until the patient is
  registered; it keeps the registration's request id too, so if the host saved it but
  the answer was lost, Submit doesn't queue the patient twice
  (`hooks/useNewFormDraft.ts`). The referral dialog doesn't keep drafts.
  (`lib/drafts.ts`.)
- Each prescription is its own record, so doctors can still prescribe after their
  consultation notes are saved. Cancelling or dispensing one needs **Pharmacy stock**,
  since it changes stock.
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

- The server checks the account, role, screening date and permissions on every request
  (`middleware/authorizeApi.js`), so a disabled account, a changed date or a changed
  permission takes effect immediately, even with an old sign-in. `GET /api/auth/me` and
  sign-in return the account's `permissions`; the app hides what they don't allow
  (`src/lib/permissions.ts`), and AuthWrapper picks up changes on each page change.
- `users.permissions` (migration `028_account_permissions.sql`) lists the permission keys:
  `view_today`, `edit_today`, `view_past`, `edit_past`, `pharmacy`, `print`, `analytics`.
  Existing accounts get the defaults (`view_today`, `edit_today`), which is what they could
  do before. The admin has every permission whatever is saved. `POST /api/accounts` and
  `PUT /api/accounts/:id` take `permissions` (a list); what a permission needs is added
  (`normalizePermissions` in `utils/permissions.js`).
- Each request needs one permission (`requiredPermission` in `utils/permissions.js`):
  `GET /patients` and `/patients/search` need `view_today`; `/analytics` needs
  `analytics`; `/export/patients` and `GET /visits/referrals` need `print`; record saves,
  record corrections and queue moves need `edit_today`; pharmacy stock, dispensing and
  cancelling prescriptions need `pharmacy`. A refusal is `403` with
  `{ message, missing_permission }`. `/accounts`, `/form-options` changes, and every DELETE
  are admin only.
- Every account except the admin works on one day: a screening-day account on its
  screening date, any other non-admin account on the host's clinic day (`workingDay` in
  `utils/dayScope.js`). Lists filter by it (`req.user.scope_date`, null with `view_past`);
  a request for one patient or visit is checked before it reaches its route. Reading needs
  the patient to have a visit on that day (unless `view_past`); saving needs the host's
  date to be that day, and the visit itself to be on that day (unless `edit_past`).
  Requests it doesn't recognise are refused.
- `GET /api/patients/lookup?q=..` (3+ letters, 10 results, identifying fields only) is
  how an account without `view_past` finds other patients to queue them.
- Saving over an existing record goes through `canEditSavedRecords` in
  `utils/permissions.js`, used in each save's `ON CONFLICT ... WHERE`, so an unknown role
  still can't change a saved record.
- The shared `user` sign-in is disabled at start-up by
  `migrations/022_retire_shared_user_account.sql` (only an account named `user` with no
  screening date).
- `last_updated_by` and timestamps change only when a save is allowed and succeeds.
  Everyone on a screening day shares one account, so records show that account, not
  the individual volunteer. Changing an account's permissions sets its `last_updated_by`.
- `POST /api/auth/register` and `POST /api/users` always refuse account creation;
  accounts are created only through `POST /api/accounts`.
- `npm run seed:admin` and `npm run seed:stations` are older names for the same
  account setup.

Tests (database tests use temporary tables only):

```powershell
npm test --workspace apps/frontend
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand permissions.test.js stationUsers.database.test.js savedRecords.database.test.js referral.database.test.js analytics.database.test.js dayAccounts.database.test.js visitEdits.database.test.js tbFlow.database.test.js removeLocations.database.test.js
```
