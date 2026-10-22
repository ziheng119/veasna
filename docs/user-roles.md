# Admin and user access

Only two roles are assignable: **admin** and **user**. Both can view every page,
including patient details, clinical stations, Pharmacy and Analytics. Users can
create records; only admins can change or delete saved data, including their own
previous entries. There is no same-day exception.

| Action | User | Admin |
| --- | --- | --- |
| View/search all pages, queues, current/past records and Analytics | Yes | Yes |
| Print saved referrals, individually or by day | Yes | Yes |
| Register a patient or create a new visit | Yes | Yes |
| Enter a previously absent triage section or station note | First save only | Yes |
| Create a referral and initial signature | First save only | Yes |
| Revise demographics, queue numbers, vitals/HEF or saved clinical notes | No | Yes |
| Edit/clear a saved signature or delete a referral | No | Yes |
| Change queue routing, complete stations or discharge | No | Yes |
| Create a new inventory item | Yes | Yes |
| Change existing stock/name or delete inventory | No | Yes |
| Create accounts | No | No |
| Manage locations | No | Yes |

A first TB review is initial clinical data even though registration already
created its screening row. It may advance the queue as part of recording that
first decision. A subsequent review requires an admin. Creating a new referral
also synchronizes the consultation's derived referral flag without granting
permission to change saved notes or prescriptions.

Each triage section, consultation, SEVA note, physiotherapy record and referral
has its own first-save boundary. Empty/partial saved records count as saved.
A referral created before consultation notes does not prevent initial notes.
When creating a new visit for an existing patient, a user's submitted demographic
changes are ignored; existing patient details are preserved. Ask an admin to
correct them. New visit vitals and HEF remain new records.

## Fixed accounts and setup

The only active sign-ins are **admin / admin12345** and **user / user** (username / password).
They have the Admin and User permissions above. There is no Add User menu, and
both POST /api/auth/register and POST /api/users reject account creation even for admins.

Run from the repository root: npm run setup:accounts --workspace apps/backend.
This explicit command resets those two passwords, corrects their roles, enables
them and retires every other login in one transaction. Repeating it preserves
the two account IDs. Existing inactive account rows remain to preserve clinical
author/signature foreign keys; they cannot log in or use previously issued tokens.
No clinical records or author IDs are reassigned or deleted.

The old seed:admin and seed:stations commands now call the same fixed-account
setup for compatibility. Backend setup also configures these two accounts.
This is not run automatically during normal server startup.

Restart the backend and rebuild/restart the frontend to load the removed account
creation functionality. API requests still verify the current active database
account and role on every request. No cloud service is required.

## Enforcement and verification

The gateway allowlists creation-capable POST endpoints and denies user
PUT/PATCH/DELETE and administrative POST operations. Legacy clinical write aliases
are admin-only so they cannot bypass visit-based protections.
Clinical upserts use PostgreSQL's unique visit constraint and an admin-only
ON CONFLICT UPDATE condition. Two concurrent first saves cannot overwrite one
another: one succeeds, the other receives 403. Physiotherapy rolls back before
changing pain points; a denied referral save cannot change its consultation flag.
TB reviews check reviewed_at while holding the visit row lock. Audit authors and
timestamps only change on authorized successful writes.

Forms load saved data before enabling first entry and become read-only after
save. The backend remains authoritative if another device saves first. Users can
open a saved referral to view/print without issuing a write. Failed clinical data
loads must not be treated as empty editable records.

Tests cover page access, editable/locked UI transitions, permission matrices,
stale/forged token roles, disabled accounts, account setup, simultaneous first
referral saves, clinical sections and signatures. Database tests use only
connection-local temporary tables:

```powershell
npm.cmd test --workspace apps/frontend -- --runInBand
$env:RUN_DB_TESTS='1'
npm.cmd test --workspace apps/backend -- --runInBand permissions.test.js stationUsers.database.test.js savedRecords.database.test.js referral.database.test.js analytics.database.test.js
```
