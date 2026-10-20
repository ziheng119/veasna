# Station accounts and permissions

VEASNA supports a single assigned role per account, with local PostgreSQL
authentication. Admins retain all pages. Registration shares Home and Patient List;
each clinical station has its own assigned account. This controls pages and
clinical writes, not exclusive ownership of a particular patient.

## Starter accounts

For this initial setup, **each password is exactly the username** below. Passwords
are stored as bcrypt hashes, not plaintext.

| Username | Role | Pages |
| --- | --- | --- |
| `clinic_admin` | `admin` | All pages, Analytics, user and location management |
| `registration` | `registration` | Home/registration, Patient List, patient details |
| `triage_doctor` | `triage` | Triage |
| `tb_doctor` | `tb` | TB Tent |
| `seva_doctor` | `seva` | Seva |
| `physio_doctor` | `physiotherapy` | Physiotherapy |
| `consult_doctor` | `consultation` | Consult, referral editing/deletion and printing |
| `pharmacist` | `pharmacy` | Pharmacy and its dashboard |

These are starter/shared station accounts. For individual attribution, an admin
can use **Add User**, set a username/password, and select the assigned role.
Custom passwords still have the existing eight-character minimum. Use individual
credentials in place of these temporary matching passwords when moving beyond
this initial setup.

Run from the repository root:

```powershell
npm.cmd run seed:stations --workspace apps/backend
```

The script creates missing accounts only, preserves existing passwords, roles and
disabled states, and reports collisions without modifying them. It is never run
automatically at startup. It ensures the existing password/role columns are
present; no new schema migration is required. Restart the backend after deploying
the API changes. Existing admin accounts are untouched.

## Enforcement

- The user menu/navigation shows permitted pages, and login goes straight to the
  role's default page. Direct URLs are guarded too.
- `/api/auth/me` refreshes the current role for page access. The API gateway checks
  the active account and role in PostgreSQL on **every** request, rather than
  trusting a stale JWT role or any role submitted in the request body.
- Only admins can register accounts, manage locations/users, access Analytics, or
  use existing admin-only deletion operations.
- Station roles can save only their own station's forms. Completing another
  station through a crafted queue API request is denied.
- Clinical station staff can edit routing and discharge patients; existing TB
  holds remain enforced. Registration retains queue/visit administration.
- Shared authenticated patient snapshots, histories, locations and queue reads
  remain available across clinical roles because each station requires that
  context. This is not field-by-field clinical-data segregation.
- Pharmacy inventory operations belong to Pharmacy/Admin; the existing
  admin-only inventory deletion rule is retained.
- Referrals belong to Consultation/Admin. Analytics remains admin-only.
- New/unknown API writes default to denied for assigned station roles.
- Existing `user` accounts retain legacy general-clinic access for compatibility,
  but never admin tools. They are not created by the new role picker or starter
  setup; replace them with assigned accounts when restricting existing staff.
- `last_updated_by` continues to record the authenticated user's ID. Role checks
  do not change patient data or audit IDs.

The backend policy lives in `utils/permissions.js` and its gateway middleware.
Frontend route mappings live in `src/lib/permissions.ts`; tests cover both.
No cloud identity provider or internet connection is required.

## Verification

```powershell
npm.cmd test --workspace apps/frontend -- --runInBand
$env:RUN_DB_TESTS='1'
npm.cmd test --workspace apps/backend -- --runInBand tests/permissions.test.js tests/stationUsers.database.test.js
```

Database tests use temporary tables only. They cover all starter logins, password
hashing, repeatable setup, existing-account preservation, inactive accounts,
role changes with old tokens, admin-only registration and cross-station denials.
Frontend tests cover navigation mappings, default pages and direct-URL guards.
