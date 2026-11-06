# Accounts and permissions

Veasna has two fixed sign-ins, plus screening-day accounts that the admin creates:

| Account | Password | Sees |
| --- | --- | --- |
| `admin` | `admin12345` | Everything |
| `user` | `user` | Every day's patients |
| Screening-day account, e.g. `dec13village` | chosen by the admin, e.g. `ilovebtb` | Only patients queued on its screening day, and their earlier visits |

## Screening-day accounts

Make one account per screening day and hand it to everyone working that day. Everyone
shares it.

1. Sign in as `admin`, open the user menu and choose **Accounts**.
2. Under **New screening-day account**, type the username (e.g. `dec13village`), the
   password (e.g. `ilovebtb`) and the screening date (e.g. 13 December), then press
   **Create**.

The account then:

- **Sees only that day's patients.** Patient List, every queue and the pharmacy show
  only patients queued on its screening date. A patient who came on an earlier trip
  appears once they are queued that day, and their profile shows all their earlier
  visits. Other patients, from other trips or days, can't be opened.
- **Can find returning patients to queue them.** On Home, typing 3 or more letters of a
  name lists matching earlier patients (name, date of birth, sex, phone, address, ID
  only, no clinical records), so their new visit joins their existing record.
- **Saves only on its screening day, and only to that day's visits.** Earlier visits
  are read-only. On another day it can still sign in and look, but every save is
  refused with a message naming its date. The host laptop's clock decides what "today"
  is, so check it before the clinic opens.
- Otherwise works like `user`: it enters new records, but can't change saved ones.

On the **Accounts** page the admin can change an account's date or password, disable
or enable it, or remove it. An account that entered any records is disabled instead of
removed, so the records still show who entered them.

## What each account can do

| Action | User / screening day | Admin |
| --- | --- | --- |
| View and search pages, queues and patient records (screening-day accounts: that day's patients only) | Yes | Yes |
| Open **Analytics** | No | Yes |
| Print one saved referral | Yes | Yes |
| Print referrals for a day, a period or every date at once | No | Yes |
| **Download all patient data** (Patient List) | No | Yes |
| Change the choices in station forms (**Station data**) | No | Yes |
| Create, change or remove screening-day accounts (**Accounts**) | No | Yes |
| Register a patient or start a new visit | Yes | Yes |
| Group patients into a family, or take one out (**Add to family** on Patient List) | Yes | Yes |
| Fill in a station form or triage section for the first time | Yes | Yes |
| Create a referral and sign it for the first time | Yes | Yes |
| Change saved details: names, queue numbers, vitals, HEF, clinical notes | No | Yes |
| Delete a patient, or one visit of a patient (**Delete visit** on the patient's record) | No | Yes |
| Change or clear a saved signature, or delete a referral | No | Yes |
| Send a patient to the next station (**Next/Finish**), change their stations or their order (**Send to**), or discharge them | Yes | Yes |
| Change a suspected TB patient's stations (they only go to Consult) | No | No |
| Add a new medicine to the pharmacy | Yes | Yes |
| Prescribe from the pharmacy (reserves the stock) | Yes | Yes |
| Change stock, rename or delete a medicine, dispense, or cancel a prescription | No | Yes |
| Flag a patient for suspected TB, or clear the flag at Consult after a doctor has seen them | Yes | Yes |
| Change a TB flag's red flags or notes | No | Yes |
| Add or remove clinic locations | No | Yes |

## What "first time" means

- Each form has its own first save: every triage section, consultation notes, partner
  NGO notes, physiotherapy, dental notes and referral. Once saved, even half-filled, the form is locked
  for users.
- Flagging suspected TB counts as a first entry. Anyone can clear the flag in the
  Consult queue, since the doctor who sees the patient in the TB tent needs to. Changing the red flags or notes of
  a flag needs an admin.
- Each prescription is its own record, so doctors can still prescribe after their
  consultation notes are saved.
- When a user starts a new visit for an existing patient, the patient's saved details
  (name, date of birth and so on) are kept as they were. Ask an admin to correct them.
  The new visit's vitals and HEF are new records, so the user can enter them.
- If two people save the same empty form at the same moment, only the first save is
  kept. The other person sees a "not allowed" message instead of overwriting it.

Saved forms appear read-only for users. Users can still open a saved referral to
view or print it.

## Resetting the fixed accounts

From the project folder:

```bash
npm run setup:accounts --workspace apps/backend
```

This resets the `admin` and `user` passwords and roles above and disables every other
sign-in except screening-day accounts, which are left as they are. Old accounts are
kept so earlier records still show who entered them, but they can no longer sign in.
No clinical records are changed. `npm run setup:backend` does the same as part of
first-time setup. It never runs on its own when the server starts.

## Technical details

- The server checks the account, role and screening date on every request, so a
  disabled account or a changed date takes effect immediately, even with an old sign-in.
- A screening-day account is a `user` account with `users.screening_date` set
  (migration `020_day_accounts_form_options.sql`). `utils/dayScope.js` limits it: lists
  filter by that date in their queries, and a request for one patient or visit is
  checked before it reaches its route. Reading needs the patient to have a visit on
  that date; saving needs the visit itself to be on that date, and the host's date to
  be the screening date. Requests it doesn't recognise are refused.
- `GET /api/patients/lookup?location_id=..&q=..` (3+ letters, 10 results, identifying
  fields only) is the one way a screening-day account sees other patients.
- Admin only: `/api/analytics`, `/api/accounts`, `/api/export/patients`,
  `GET /api/visits/referrals` (bulk printing), `DELETE /api/visits/:id` and every
  change to `/api/form-options`.
- Users are allowed only a fixed list of "create" requests, plus moving patients
  between stations (`POST queue/{id}/stations/{station}/complete`,
  `PUT queue/{id}/stations`, `PUT queue/{id}/stations/{station}`, `POST queue/{id}/complete`). Other changes (PUT, PATCH,
  DELETE and admin requests) are refused. Older edit addresses are admin-only, so
  they can't be used to get around these checks.
- First saves rely on the database's one-record-per-visit rule. An update to an
  existing record is allowed only for admins, so two simultaneous first saves can't
  overwrite each other: one succeeds and the other gets HTTP 403.
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
npm test --workspace apps/backend -- --runInBand permissions.test.js stationUsers.database.test.js savedRecords.database.test.js referral.database.test.js analytics.database.test.js dayAccounts.database.test.js
```
