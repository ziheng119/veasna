# Accounts and permissions

Veasna has two sign-ins:

| Account | Password |
| --- | --- |
| `admin` | `admin12345` |
| `user` | `user` |

New accounts cannot be created, even by an admin.

Both accounts can **see** everything. The difference is in changing things: a user
can enter information the first time, but only an admin can change or delete
something once it is saved. This applies to a user's own entries too, on any day.

| Action | User | Admin |
| --- | --- | --- |
| View and search all pages, queues, past records and Analytics | Yes | Yes |
| Print saved referrals, one at a time or the whole day | Yes | Yes |
| Register a patient or start a new visit | Yes | Yes |
| Fill in a station form or triage section for the first time | Yes | Yes |
| Create a referral and sign it for the first time | Yes | Yes |
| Change saved details: names, queue numbers, vitals, HEF, clinical notes | No | Yes |
| Change or clear a saved signature, or delete a referral | No | Yes |
| Change a patient's stations, finish a station or discharge | No | Yes |
| Add a new medicine to the pharmacy | Yes | Yes |
| Change stock, rename or delete a medicine, or dispense | No | Yes |
| Add or remove clinic locations | No | Yes |
| Create accounts | No | No |

## What "first time" means

- Each form has its own first save: every triage section, consultation notes, Seva,
  physiotherapy and referral. Once saved, even half-filled, the form is locked for users.
- The first TB review counts as a first entry, and may move the patient on to their
  next station. A second review needs an admin.
- When a user starts a new visit for an existing patient, the patient's saved details
  (name, date of birth and so on) are kept as they were. Ask an admin to correct them.
  The new visit's vitals and HEF are new records, so the user can enter them.
- If two people save the same empty form at the same moment, only the first save is
  kept. The other person sees a "not allowed" message instead of overwriting it.

Saved forms appear read-only for users. Users can still open a saved referral to
view or print it.

## Setting up the accounts

From the project folder:

```bash
npm run setup:accounts --workspace apps/backend
```

This resets the two passwords and roles above and disables every other sign-in.
Old accounts are kept so earlier records still show who entered them, but they
can no longer sign in. No clinical records are changed. `npm run setup:backend` does
the same as part of first-time setup. It never runs on its own when the server starts.

## Technical details

- The server checks the account and role on every request, so a disabled account or
  a changed role takes effect immediately, even with an old sign-in.
- Users are allowed only a fixed list of "create" requests. Other changes (PUT, PATCH,
  DELETE and admin requests) are refused. Older edit addresses are admin-only, so
  they can't be used to get around these checks.
- First saves rely on the database's one-record-per-visit rule. An update to an
  existing record is allowed only for admins, so two simultaneous first saves can't
  overwrite each other: one succeeds and the other gets HTTP 403.
- `last_updated_by` and timestamps change only when a save is allowed and succeeds.
- `POST /api/auth/register` and `POST /api/users` always refuse account creation.
- `npm run seed:admin` and `npm run seed:stations` are older names for the same
  account setup.

Tests (database tests use temporary tables only):

```powershell
npm test --workspace apps/frontend
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand permissions.test.js stationUsers.database.test.js savedRecords.database.test.js referral.database.test.js analytics.database.test.js
```
